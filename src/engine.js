import { hasWebGPU } from './compat.js';
import { fromHub } from 'https://esm.sh/parakeet.js@1.4.4';

const MODEL_KEY = 'parakeet-tdt-0.6b-v3';

// truthy when ready: true (worker mode) or model object (main-thread fallback)
export let parakeetModel  = null;
export let parakeetWorker = null;

let workerJobSeq     = 0;
const workerPending  = {};    // job id → { resolve, reject }
let workerOnProgress = null;  // set during model download, cleared after

const txQueue   = [];
let   txRunning = false;

// Setter used by test hooks — nulling model also clears the worker reference
export function setParakeetModel(v) {
  parakeetModel = v;
  if (!v) parakeetWorker = null;
}

// ── TRANSCRIPTION QUEUE ──────────────────────────────────────────────────────
// All inference is serialised so only one transcription runs at a time.
// priority=true inserts the job next in queue (mic-triggered jobs skip ahead).

function runQueued(fn, priority = false) {
  return new Promise((resolve, reject) => {
    const job = { fn, resolve, reject };
    if (priority) txQueue.unshift(job);
    else          txQueue.push(job);
    drainTxQueue();
  });
}

async function drainTxQueue() {
  if (txRunning || !txQueue.length) return;
  txRunning = true;
  const { fn, resolve, reject } = txQueue.shift();
  try   { resolve(await fn()); }
  catch (e) { reject(e); }
  finally   { txRunning = false; drainTxQueue(); }
}

// ── WORKER ───────────────────────────────────────────────────────────────────
// parakeet.js runs in a Web Worker so inference is off the main thread.
// Audio is transferred via ArrayBuffer transfer (zero-copy).

function handleWorkerMessage({ data }) {
  if (data.type === 'result') {
    const cb = workerPending[data.id]; delete workerPending[data.id];
    if (cb) cb.resolve(data.text);
  } else if (data.type === 'error') {
    const cb = workerPending[data.id]; delete workerPending[data.id];
    if (cb) cb.reject(new Error(data.error));
  } else if (data.type === 'progress') {
    workerOnProgress?.(data.p);
  }
}

const WORKER_SCRIPT = `
import { fromHub } from 'https://esm.sh/parakeet.js@1.4.4';
const MODEL_KEY = 'parakeet-tdt-0.6b-v3';
let model = null;

self.onmessage = async ({ data }) => {
  if (data.type === 'load') {
    try {
      const opts = { ...data.opts };
      if (data.reportProgress) opts.progress = p => self.postMessage({ type: 'progress', p });
      model = await fromHub(MODEL_KEY, opts);
      self.postMessage({ type: 'ready' });
    } catch (e) {
      self.postMessage({ type: 'load_error', error: e.message });
    }
  } else if (data.type === 'transcribe') {
    try {
      const f32 = new Float32Array(data.buffer);
      const res  = await model.transcribeLongAudio(f32, 16000, { returnTimestamps: false });
      self.postMessage({ type: 'result', id: data.id, text: res.text });
    } catch (e) {
      self.postMessage({ type: 'error', id: data.id, error: e.message });
    }
  }
};
`;

async function initParakeetWorker(opts, onProgress) {
  const blob = new Blob([WORKER_SCRIPT], { type: 'text/javascript' });
  const url  = URL.createObjectURL(blob);
  const w    = new Worker(url, { type: 'module' });
  URL.revokeObjectURL(url);
  workerOnProgress = onProgress || null;
  return new Promise((resolve, reject) => {
    w.onerror = e => { w.terminate(); reject(new Error(e.message || 'Worker init error')); };
    w.onmessage = ({ data }) => {
      if (data.type === 'ready') {
        parakeetWorker = w;
        workerOnProgress = null;
        w.onmessage = handleWorkerMessage;
        resolve();
      } else if (data.type === 'load_error') {
        w.terminate(); reject(new Error(data.error));
      } else if (data.type === 'progress') {
        workerOnProgress?.(data.p);
      }
    };
    w.postMessage({ type: 'load', opts, reportProgress: !!onProgress });
  });
}

export async function loadParakeet(onProgress) {
  const opts = {
    backend:             hasWebGPU ? 'webgpu' : 'wasm',
    encoderQuant:        'fp32',   // int8 silently forced to fp32 for WebGPU anyway
    decoderQuant:        'int8',
    preprocessorBackend: 'js',
  };
  try {
    await initParakeetWorker(opts, onProgress);
    parakeetModel = true;   // sentinel — inference runs in the worker
  } catch (workerErr) {
    console.warn('Parakeet Worker unavailable, running on main thread:', workerErr.message);
    parakeetModel = await fromHub(MODEL_KEY, {
      ...opts,
      ...(onProgress ? { progress: onProgress } : {}),
    });
  }
  localStorage.setItem('parakeet_model_ready', 'true');
}

export async function runParakeet(float32, priority = false) {
  return runQueued(async () => {
    if (parakeetWorker) {
      // Worker path — transfer the ArrayBuffer (zero-copy; float32 becomes detached)
      return new Promise((resolve, reject) => {
        const id  = ++workerJobSeq;
        workerPending[id] = { resolve, reject };
        parakeetWorker.postMessage({ type: 'transcribe', id, buffer: float32.buffer }, [float32.buffer]);
      });
    }
    // Main-thread fallback
    if (!parakeetModel || parakeetModel === true) throw new Error('Model not loaded');
    const result = await parakeetModel.transcribeLongAudio(float32, 16000, { returnTimestamps: false });
    return result.text;
  }, priority);
}
