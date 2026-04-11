import { hasSimd } from './compat.js';
import { cfg, busy, files, modelStatus, modelPanelVis, simdErrorVis, dlProgress } from './signals.js';
import { loadParakeet } from './engine.js';
import { startBatch } from './transcription.js';

export async function checkModelStatus() {
  if (!hasSimd) {
    modelStatus.value   = { dot: 'missing', label: 'Not supported' };
    modelPanelVis.value = true;
    simdErrorVis.value  = true;
    return;
  }
  if (localStorage.getItem('parakeet_model_ready') === 'true') {
    modelStatus.value   = { dot: 'loading', label: 'Loading model…' };
    modelPanelVis.value = false;
    try {
      await loadParakeet();
      modelStatus.value = { dot: 'cached', label: 'Model ready' };
      // If auto-reconnect already populated files, kick off auto-transcribe now
      if (cfg.value.auto_transcribe && !busy.value && files.value.some(f => f.status === 'pending')) {
        startBatch();
      }
    } catch {
      localStorage.removeItem('parakeet_model_ready');
      modelStatus.value   = { dot: 'missing', label: 'Model not downloaded' };
      modelPanelVis.value = true;
    }
  } else {
    modelStatus.value   = { dot: 'missing', label: 'Model not downloaded' };
    modelPanelVis.value = true;
  }
}

export async function downloadModel() {
  dlProgress.value  = { visible: true, pct: 0, label: 'Starting download…' };
  modelStatus.value = { dot: 'loading', label: 'Downloading…' };
  try {
    await loadParakeet(p => {
      if (!p) return;
      const pct = typeof p === 'number' ? p : p.progress != null ? p.progress : (p.loaded && p.total) ? (p.loaded / p.total * 100) : null;
      dlProgress.value = {
        visible: true,
        pct:   pct != null ? Math.min(99, pct) : dlProgress.value.pct,
        label: p.file ? `Downloading ${p.file}…` : p.status === 'loading' ? 'Loading model into memory…' : dlProgress.value.label,
      };
    });
    dlProgress.value  = { visible: true, pct: 100, label: 'Done' };
    modelStatus.value = { dot: 'cached', label: 'Model ready' };
    modelPanelVis.value = false;
  } catch (e) {
    dlProgress.value  = { ...dlProgress.value, label: `Failed: ${e.message}` };
    modelStatus.value = { dot: 'missing', label: 'Download failed' };
    console.error('Model load failed:', e);
  }
}
