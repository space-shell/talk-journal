import { cfg, files, busy, deleteBannerVis, updateFile } from './signals.js';
import { prepareAudio } from './audio.js';
import { runParakeet } from './engine.js';
import { genId } from './helpers.js';
import { saveTx, updateTx, refreshHistory, refreshStorage } from './storage.js';
import { isLlmReady, runLlmFormat } from './llm.js';

export function requestBatch() {
  if (busy.value) return;
  if (cfg.value.delete_after_transcription) { deleteBannerVis.value = true; }
  else startBatch();
}

export async function startBatch() {
  if (busy.value) return;
  busy.value = true;
  for (let i = 0; i < files.value.length; i++) {
    const f = files.value[i];
    if (!f.selected || f.status === 'done' || f.status === 'cleared') continue;
    await transcribeFile(i);
  }
  busy.value = false;
  refreshHistory();
}

export async function transcribeFile(i) {
  updateFile(i, { status: 'converting', error: null });
  try {
    const raw    = await files.value[i].handle.getFile();
    let float32  = await prepareAudio(await raw.arrayBuffer());

    updateFile(i, { status: 'transcribing' });

    const text = await runParakeet(float32);
    float32 = null; // release ~100 MB+ audio buffer

    if (!text?.trim()) throw new Error('Transcription returned an empty result');

    const transcript = text.trim();
    updateFile(i, { transcript, status: 'done' });

    let savedId = files.value[i].savedId;

    if (cfg.value.auto_save) {
      const entry = {
        id:              genId(),
        filename:        files.value[i].name,
        transcribedAt:   new Date().toISOString(),
        durationSeconds: Math.round(files.value[i].size / (17 * 1024 * 1024) * 60),
        text:            transcript,
        silenceRemoved:  cfg.value.vad_enabled,
        deleted:         false,
        notes:           '',
        entries:         [],
      };
      saveTx(entry);
      savedId = entry.id;
      updateFile(i, { savedId });
      refreshStorage();
    }

    // Per-file deletion — only after localStorage confirmed
    if (cfg.value.delete_after_transcription && savedId) {
      try {
        await files.value[i].handle.remove();
        updateFile(i, { deleted: true });
        updateTx(savedId, { deleted: true });
      } catch (e) { console.warn('Could not delete', files.value[i].name, e); }
    }

    updateFile(i, { handle: null }); // release file handle

    if (cfg.value.llm_formatting && isLlmReady()) {
      queueFormatFile(i, savedId);
    }
  } catch (e) {
    updateFile(i, { error: e.message, status: 'error' });
  }
}

export async function retryFile(i) {
  if (busy.value) return;
  busy.value = true;
  await transcribeFile(i);
  busy.value = false;
  refreshHistory();
}

function queueFormatFile(i, savedId) {
  updateFile(i, { formatting: 'pending' });
  (async () => {
    try {
      updateFile(i, { formatting: 'formatting' });
      const raw = files.value[i].transcript;
      const formatted = await runLlmFormat(raw);
      updateFile(i, { formattedText: formatted, formatting: 'done', txView: 'formatted' });
      if (savedId) updateTx(savedId, { formattedText: formatted });
      refreshStorage();
    } catch (e) {
      console.warn('LLM formatting failed for', files.value[i]?.name, e);
      updateFile(i, { formatting: 'error' });
    }
  })();
}

export function reformatFile(i) {
  const f = files.value[i];
  if (!f?.transcript) return;
  queueFormatFile(i, f.savedId);
}
