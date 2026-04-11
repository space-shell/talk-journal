import { cfg } from './signals.js';

export async function prepareAudio(arrayBuffer) {
  const audioCtx    = new AudioContext();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
  await audioCtx.close();
  const targetRate = 16000;
  const numFrames  = Math.ceil(audioBuffer.duration * targetRate);
  const offCtx     = new OfflineAudioContext(1, numFrames, targetRate);
  const src        = offCtx.createBufferSource();
  src.buffer = audioBuffer; src.connect(offCtx.destination); src.start();
  const rendered = await offCtx.startRendering();
  let float32 = rendered.getChannelData(0);
  if (cfg.value.vad_enabled) float32 = removeSilence(float32, targetRate);
  return float32;
}

export function removeSilence(float32, sampleRate) {
  const c = cfg.value;
  const chunkMs      = 20;
  const chunkSize    = Math.floor(sampleRate * chunkMs / 1000);
  const padChunks    = Math.ceil(c.vad_padding_ms / chunkMs);
  const minSilChunks = Math.ceil(c.vad_min_silence_ms / chunkMs);
  const threshold    = c.vad_threshold;

  const voiced = [];
  for (let i = 0; i < float32.length; i += chunkSize) {
    const chunk = float32.subarray(i, i + chunkSize);
    const rms   = Math.sqrt(chunk.reduce((s, x) => s + x * x, 0) / chunk.length);
    voiced.push(rms >= threshold);
  }
  const padded = voiced.slice();
  for (let i = 0; i < voiced.length; i++) {
    if (voiced[i]) {
      const lo = Math.max(0, i - padChunks), hi = Math.min(voiced.length, i + padChunks + 1);
      for (let j = lo; j < hi; j++) padded[j] = true;
    }
  }
  let run = 0;
  for (let i = 0; i <= padded.length; i++) {
    if (i < padded.length && !padded[i]) { run++; }
    else { if (run > 0 && run < minSilChunks) for (let j = i - run; j < i; j++) padded[j] = true; run = 0; }
  }
  const parts = [];
  for (let i = 0; i < padded.length; i++) if (padded[i]) parts.push(float32.subarray(i * chunkSize, Math.min((i+1)*chunkSize, float32.length)));
  if (!parts.length) return float32;
  const out = new Float32Array(parts.reduce((s, c) => s + c.length, 0));
  let off = 0; for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}
