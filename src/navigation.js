import { batch } from './lib.js';
import { files, appView, wizardIndex, dirHandle, busy, deleteBannerVis, updateFile } from './signals.js';
import { updateTx, allTx, refreshHistory } from './storage.js';

export function activeFiles() {
  return files.value.filter(f => !f.completed && !f.deleted && f.status !== 'cleared');
}

export function goNext() {
  const idx = wizardIndex.value;
  const fs  = files.value;
  const f   = fs[idx];
  // Mark current file complete if it isn't already
  if (f && !f.completed) {
    updateFile(idx, { completed: true });
    if (f.savedId) updateTx(f.savedId, { completed: true });
  }
  // Find next reviewable incomplete file after current position
  const nextIdx = fs.findIndex((x, i) => i > idx && !x.completed && !x.deleted && x.status !== 'cleared');
  if (nextIdx === -1) {
    appView.value = 'summary';
  } else {
    wizardIndex.value = nextIdx;
  }
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
