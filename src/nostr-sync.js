import { signal } from './lib.js';
import { NOSTR_D_PREFIX } from './config.js';
import { loadPrivkey, pubkeyFromPrivkey } from './nostr-keys.js';
import { buildEntryEvent, decodeEntryEvent, getDTag } from './nostr-events.js';
import { publishEvent, fetchEntries, connectRelays, loadRelays } from './nostr-relay.js';
import { getTx, saveTx, updateTx, suppressHooks, resumeHooks, refreshHistory, setStorageHooks } from './storage.js';

const PENDING_KEY   = 'tj_nostr_pending';   // JSON array of entry IDs awaiting publish
const LAST_SYNC_KEY = 'tj_nostr_last_sync';

export const nostrStatus = signal({
  state:    'idle',   // 'idle' | 'syncing' | 'error'
  lastSync: localStorage.getItem(LAST_SYNC_KEY) || null,
  error:    null,
});

function getPending()      { try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); } catch { return []; } }
function addPending(id)    { const p = getPending(); if (!p.includes(id)) { p.push(id); localStorage.setItem(PENDING_KEY, JSON.stringify(p)); } }
function removePending(id) { localStorage.setItem(PENDING_KEY, JSON.stringify(getPending().filter(x => x !== id))); }

export async function pushEntry(entry) {
  const privkey = loadPrivkey();
  if (!privkey || !entry) return;
  try {
    const results = await publishEvent(buildEntryEvent(entry, privkey));
    if (results.length && results.every(r => r.ok)) removePending(entry.id);
    else addPending(entry.id);
  } catch {
    addPending(entry.id);
  }
}

export async function pushPending() {
  const privkey = loadPrivkey();
  if (!privkey) return;
  for (const id of getPending()) {
    const entry = getTx(id);
    if (entry) await pushEntry(entry);
  }
}

export async function pullAll() {
  const privkey = loadPrivkey();
  if (!privkey) return;
  nostrStatus.value = { ...nostrStatus.value, state: 'syncing', error: null };
  try {
    const events = await fetchEntries(pubkeyFromPrivkey(privkey));
    suppressHooks();
    try {
      for (const event of events) {
        const dTag = getDTag(event);
        if (!dTag.startsWith(NOSTR_D_PREFIX)) continue;
        const uuid    = dTag.slice(NOSTR_D_PREFIX.length);
        const decoded = decodeEntryEvent(event, privkey);
        if (!decoded) continue;
        const local = getTx(uuid);
        if (!local) {
          saveTx({ ...decoded, id: uuid, _nostrAt: event.created_at });
        } else if (event.created_at > (local._nostrAt || 0)) {
          updateTx(uuid, { ...decoded, _nostrAt: event.created_at });
        }
      }
    } finally {
      resumeHooks();
    }
    refreshHistory();
    const now = new Date().toISOString();
    localStorage.setItem(LAST_SYNC_KEY, now);
    nostrStatus.value = { state: 'idle', lastSync: now, error: null };
  } catch (err) {
    nostrStatus.value = { ...nostrStatus.value, state: 'error', error: err.message };
  }
}

export async function syncNow() {
  await pullAll();
  await pushPending();
}

export function autoSync() {
  const privkey = loadPrivkey();
  const relays  = loadRelays();
  if (!privkey || !relays.length) return;
  connectRelays(relays);
  setTimeout(syncNow, 1500);
}

// Register storage hooks so local saves are automatically pushed.
// Checks at call-time whether Nostr is configured, so safe to register unconditionally.
setStorageHooks({
  onSave:   entry => { if (loadPrivkey() && loadRelays().length) pushEntry(entry).catch(() => {}); },
  onUpdate: entry => { if (entry && loadPrivkey() && loadRelays().length) pushEntry(entry).catch(() => {}); },
});
