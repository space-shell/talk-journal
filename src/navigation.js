import { batch } from './lib.js';
import { files, appView, wizardIndex, dirHandle, busy, deleteBannerVis, updateFile } from './signals.js';
import { updateTx, allTx, refreshHistory } from './storage.js';

export function activeFiles() {
  return files.value.filter(f => !f.completed && !f.deleted && f.status !== 'cleared');
}

export function goNext() {
  const active  = activeFiles();
  const idx     = wizardIndex.value;
  const f       = active[idx];
  // Mark current entry complete
  if (f) {
    const realIdx = files.value.indexOf(f);
    updateFile(realIdx, { completed: true });
    if (f.savedId) updateTx(f.savedId, { completed: true });
  }
  // Re-check remaining (signal updated synchronously above)
  const remaining = files.value.filter(x => !x.completed && !x.deleted && x.status !== 'cleared');
  if (remaining.length === 0 || idx >= remaining.length) appView.value = 'summary';
  // else: wizardIndex stays at idx — the next file slides into that slot
}

export function goPrev() {
  if (wizardIndex.value > 0) wizardIndex.value--;
}

export function startNewSession() {
  // Mark any in-session files that weren't explicitly completed
  files.value.forEach(f => {
    if (!f.completed && f.savedId) updateTx(f.savedId, { completed: true });
  });
  batch(() => {
    appView.value         = 'home';
    wizardIndex.value     = 0;
    files.value           = [];
    dirHandle.value       = null;
    busy.value            = false;
    deleteBannerVis.value = false;
  });
  refreshHistory();
}

export function resumeSession() {
  const incomplete = allTx().filter(e => !e.completed && !e.deleted);
  if (!incomplete.length) return;
  const fileObjs = incomplete.map(entry => ({
    name:       entry.filename,
    path:       entry.filename,
    size:       0,
    mtime:      entry.transcribedAt ? new Date(entry.transcribedAt).getTime() : Date.now(),
    handle:     null,
    selected:   false,
    status:     'done',
    transcript: entry.text || '',
    notes:      entry.notes || '',
    entries:    entry.entries || [],
    savedId:    entry.id,
    completed:  false,
    deleted:    false,
  }));
  batch(() => {
    files.value       = fileObjs;
    wizardIndex.value = 0;
    appView.value     = 'wizard';
  });
}
