import { TX_PREFIX, TX_INDEX } from './config.js';
import { historyEntries, storageInfo } from './signals.js';
import { fmtBytes } from './helpers.js';

export function getIndex() {
  try { return JSON.parse(localStorage.getItem(TX_INDEX) || '[]'); }
  catch { return []; }
}

export function saveTx(entry) {
  const idx = getIndex(); idx.unshift(entry.id);
  localStorage.setItem(TX_INDEX, JSON.stringify(idx));
  localStorage.setItem(`${TX_PREFIX}${entry.id}`, JSON.stringify(entry));
}

export function getTx(id) {
  try { return JSON.parse(localStorage.getItem(`${TX_PREFIX}${id}`) || 'null'); }
  catch { return null; }
}

export function updateTx(id, patch) {
  const entry = getTx(id); if (!entry) return;
  localStorage.setItem(`${TX_PREFIX}${id}`, JSON.stringify({ ...entry, ...patch }));
}

export function removeTx(id) {
  localStorage.setItem(TX_INDEX, JSON.stringify(getIndex().filter(x => x !== id)));
  localStorage.removeItem(`${TX_PREFIX}${id}`);
}

export function allTx()            { return getIndex().map(id => getTx(id)).filter(Boolean); }
export function getTxByFilename(n) { return allTx().find(e => e.filename === n) || null; }

export function refreshHistory() { historyEntries.value = allTx(); }

export async function refreshStorage() {
  let used = 0, total = 5 * 1024 * 1024;
  if (navigator.storage?.estimate) {
    try { ({ usage: used, quota: total } = await navigator.storage.estimate()); } catch {}
  } else {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      used += (k.length + (localStorage.getItem(k) || '').length) * 2;
    }
  }
  const pct = Math.min(100, (used / total) * 100);
  storageInfo.value = { pct, warn: pct > 80, text: `${fmtBytes(used)} used of ~${fmtBytes(total)}${pct > 80 ? ' — running low' : ''}` };
}

export async function clearHistory() {
  if (!confirm('Delete all saved transcriptions? Source audio files are not affected.')) return;
  getIndex().forEach(id => localStorage.removeItem(`${TX_PREFIX}${id}`));
  localStorage.removeItem(TX_INDEX);
  refreshHistory(); refreshStorage();
}
