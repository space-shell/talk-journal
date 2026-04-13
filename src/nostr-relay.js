import { signal } from './lib.js';

const RELAYS_KEY = 'tj_nostr_relays';
const _sockets   = new Map(); // url → WebSocket

export const relayStatuses = signal(new Map()); // url → 'connecting'|'open'|'closed'|'error'

function setStatus(url, status) {
  const m = new Map(relayStatuses.value);
  m.set(url, status);
  relayStatuses.value = m;
}

function openSocket(url) {
  const existing = _sockets.get(url);
  if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
    return existing;
  }
  setStatus(url, 'connecting');
  const ws = new WebSocket(url);
  _sockets.set(url, ws);
  ws.addEventListener('open',  () => setStatus(url, 'open'));
  ws.addEventListener('close', () => { setStatus(url, 'closed'); _sockets.delete(url); });
  ws.addEventListener('error', () => setStatus(url, 'error'));
  return ws;
}

export function loadRelays() {
  try { return JSON.parse(localStorage.getItem(RELAYS_KEY) || '[]'); } catch { return []; }
}

export function saveRelays(urls) {
  localStorage.setItem(RELAYS_KEY, JSON.stringify(urls));
}

export function connectRelays(urls) {
  urls.forEach(url => openSocket(url));
}

export function disconnectAll() {
  _sockets.forEach(ws => ws.close());
  _sockets.clear();
}

// Publish event to all configured relays. Resolves with per-relay results.
export function publishEvent(event) {
  const urls = loadRelays();
  if (!urls.length) return Promise.resolve([]);
  const msg = JSON.stringify(['EVENT', event]);
  return Promise.all(urls.map(url => new Promise(resolve => {
    const ws = openSocket(url);
    const id = event.id;
    const done = result => {
      ws.removeEventListener('message', onMsg);
      resolve(result);
    };
    const onMsg = e => {
      try {
        const d = JSON.parse(e.data);
        if (d[0] === 'OK' && d[1] === id) done({ url, ok: d[2], message: d[3] || '' });
      } catch {}
    };
    ws.addEventListener('message', onMsg);
    ws.addEventListener('close', () => done({ url, ok: false, message: 'Connection closed' }), { once: true });
    const send = () => ws.send(msg);
    if (ws.readyState === WebSocket.OPEN) send();
    else ws.addEventListener('open', send, { once: true });
    setTimeout(() => done({ url, ok: false, message: 'Timeout' }), 10000);
  })));
}

// Fetch all kind:30078 events tagged 'tibbs' from pubkey across all relays.
export function fetchEntries(pubkey) {
  const urls = loadRelays();
  if (!urls.length) return Promise.resolve([]);
  const filter = { kinds: [30078], authors: [pubkey], '#t': ['tibbs'] };

  return Promise.all(urls.map(url => new Promise(resolve => {
    const ws      = openSocket(url);
    const subId   = `tibbs-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const req     = JSON.stringify(['REQ', subId, filter]);
    const events  = [];

    const done = () => {
      ws.removeEventListener('message', onMsg);
      try { ws.send(JSON.stringify(['CLOSE', subId])); } catch {}
      resolve(events);
    };
    const onMsg = e => {
      try {
        const d = JSON.parse(e.data);
        if      (d[0] === 'EVENT' && d[1] === subId) events.push(d[2]);
        else if (d[0] === 'EOSE'  && d[1] === subId) done();
      } catch {}
    };
    ws.addEventListener('message', onMsg);
    ws.addEventListener('close', () => { ws.removeEventListener('message', onMsg); resolve(events); }, { once: true });
    const send = () => ws.send(req);
    if (ws.readyState === WebSocket.OPEN) send();
    else ws.addEventListener('open', send, { once: true });
    setTimeout(done, 15000);
  }))).then(results => {
    const byId = new Map();
    results.flat().forEach(e => { if (!byId.has(e.id)) byId.set(e.id, e); });
    return [...byId.values()];
  });
}
