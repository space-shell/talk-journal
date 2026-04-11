import { batch } from './lib.js';
import { cfg, dirHandle, files, wizardIndex, appView, deleteBannerVis } from './signals.js';
import { AUDIO_EXTS } from './config.js';
import { getTxByFilename } from './storage.js';
import { parakeetModel } from './engine.js';
import { saveHandle, loadHandle } from './fs-handles.js';
import { startBatch } from './transcription.js';

export async function pickDrive() {
  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    const found  = [];
    await scan(handle, '', found);
    found.sort((a, b) => a.path.localeCompare(b.path));
    batch(() => {
      dirHandle.value   = handle;
      files.value       = found;
      wizardIndex.value = 0;
      appView.value     = found.length ? 'wizard' : 'home';
    });
    await saveHandle(handle);
    if (found.length && cfg.value.auto_transcribe && parakeetModel && found.some(f => f.status === 'pending')) {
      if (cfg.value.delete_after_transcription) deleteBannerVis.value = true;
      else startBatch();
    }
  } catch (e) {
    if (e.name !== 'AbortError') console.error(e);
  }
}

export async function scan(handle, prefix, found) {
  for await (const [name, entry] of handle.entries()) {
    const path = prefix ? `${prefix}/${name}` : name;
    if (entry.kind === 'file' && AUDIO_EXTS.test(name)) {
      const file     = await entry.getFile();
      const existing = getTxByFilename(name);
      found.push({
        handle: entry, name, path, size: file.size, mtime: file.lastModified,
        selected:   !existing,
        status:     existing ? 'done'               : 'pending',
        transcript: existing ? existing.text        : null,
        savedId:    existing ? existing.id          : null,
        deleted:    existing ? (existing.deleted ?? false) : false,
        notes:      existing ? (existing.notes   || '')  : '',
        entries:    existing ? (existing.entries || [])  : [],
        error: null,
      });
    } else if (entry.kind === 'directory') {
      await scan(entry, path, found);
    }
  }
}

export async function tryAutoReconnect() {
  const handle = await loadHandle();
  if (!handle) return;
  try {
    const perm = await handle.queryPermission({ mode: 'readwrite' });
    if (perm !== 'granted') return;
    const found = [];
    await scan(handle, '', found);
    found.sort((a, b) => a.path.localeCompare(b.path));
    if (!found.length) return;
    batch(() => {
      dirHandle.value   = handle;
      files.value       = found;
      wizardIndex.value = 0;
      appView.value     = 'wizard';
    });
    if (cfg.value.auto_transcribe && parakeetModel && found.some(f => f.status === 'pending')) {
      startBatch();
    }
  } catch (e) { console.warn('Auto-reconnect failed:', e); }
}
