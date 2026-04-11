const HANDLE_DB    = 'tj-fs-handles';
const HANDLE_STORE = 'handles';
const HANDLE_KEY   = 'last-dir';

function openHandleDb() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(HANDLE_DB, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(HANDLE_STORE);
    req.onsuccess = e => res(e.target.result);
    req.onerror   = () => rej(req.error);
  });
}

export async function saveHandle(handle) {
  try {
    const db = await openHandleDb();
    const tx = db.transaction(HANDLE_STORE, 'readwrite');
    tx.objectStore(HANDLE_STORE).put(handle, HANDLE_KEY);
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  } catch (e) { console.warn('Could not save folder handle:', e); }
}

export async function loadHandle() {
  try {
    const db = await openHandleDb();
    const tx = db.transaction(HANDLE_STORE, 'readonly');
    return await new Promise((res, rej) => {
      const req = tx.objectStore(HANDLE_STORE).get(HANDLE_KEY);
      req.onsuccess = () => res(req.result || null);
      req.onerror   = () => rej(req.error);
    });
  } catch { return null; }
}
