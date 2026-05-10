import { html, useSignal, effect } from '../lib.js';
import { files, updateFile, cfg } from '../signals.js';
import { fmtBytes, fmtDur, fmtTime } from '../helpers.js';
import { removeTx, updateTx, refreshHistory, refreshStorage } from '../storage.js';
import { retryFile, reformatFile } from '../transcription.js';
import { sendToNotion, sendToObsidian } from '../share.js';
import { parakeetModel, runParakeet } from '../engine.js';
import { prepareAudio } from '../audio.js';
import { IconMic, IconMicActive } from './icons.js';
import { AtfInput } from './AtfInput.js';

const BADGE_MAP = {
  pending:      ['badge-pending',      'Pending'],
  converting:   ['badge-converting',   'Converting'],
  transcribing: ['badge-transcribing', 'Transcribing'],
  done:         ['badge-done',         'Done'],
  error:        ['badge-error',        'Error'],
  cleared:      ['badge-pending',      'Cleared'],
};

let mediaRecRef   = null;
let chunksRef     = [];
let notesTimerRef = null;

export function FileItem({ f, i }) {
  const notesDraft = useSignal(f.notes || '');
  const recording  = useSignal(false);
  const micBusy    = useSignal(false);
  const elapsed    = useSignal(0);

  effect(() => {
    const file = files.value[i];
    if (file?.status === 'transcribing') {
      elapsed.value = 0;
      const id = setInterval(() => { elapsed.value++; }, 1000);
      return () => clearInterval(id);
    }
  });

  const [bc, bl]   = BADGE_MAP[f.status] || BADGE_MAP.pending;
  const inProgress = f.status === 'converting' || f.status === 'transcribing';
  const c          = cfg.value;

  const isFormatting  = f.formatting === 'pending' || f.formatting === 'formatting';
  const hasFormatted  = f.formatting === 'done' && f.formattedText;
  const viewMode      = f.txView || 'raw';
  const displayText   = hasFormatted && viewMode === 'formatted' ? f.formattedText : f.transcript;

  const persistNotes = text => {
    updateFile(i, { notes: text });
    if (f.savedId) updateTx(f.savedId, { notes: text });
  };

  const onNotesChange = e => {
    const text = e.target.value;
    notesDraft.value = text;
    clearTimeout(notesTimerRef);
    notesTimerRef = setTimeout(() => persistNotes(text), 800);
  };

  const toggleRecording = async () => {
    if (recording.value) { mediaRecRef?.stop(); recording.value = false; return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        micBusy.value = true;
        try {
          const blob = new Blob(chunksRef, { type: mr.mimeType });
          const f32  = await prepareAudio(await blob.arrayBuffer());
          const text = await runParakeet(f32, true);
          if (text?.trim()) {
            const next = notesDraft.value ? `${notesDraft.value} ${text.trim()}` : text.trim();
            notesDraft.value = next;
            persistNotes(next);
          }
        } catch (e) { console.error('Mic transcription failed:', e); }
        micBusy.value = false;
      };
      mr.start(); mediaRecRef = mr; recording.value = true;
    } catch (e) { console.error('Mic access denied:', e); }
  };

  const onDelete = () => {
    if (!confirm('Remove this transcription? The source file is not affected.')) return;
    if (f.savedId) removeTx(f.savedId);
    if (f.deleted) {
      files.value = files.value.filter((_, idx) => idx !== i);
    } else {
      updateFile(i, { transcript: null, status: 'cleared', savedId: null, notes: '', entries: [], formattedText: null, formatting: null, txView: null });
      notesDraft.value = '';
    }
    refreshHistory(); refreshStorage();
  };

  return html`
    <div class="file-item">
      <div class="file-row">
        <div class="file-info">
          <div class="file-header">
            <div class="card-title">${fmtTime(f.mtime)}</div>
            <span class=${'badge ' + bc}>${bl}</span>
          </div>
          <div class="file-name" title=${f.path}>${f.path}</div>
          <div class="file-meta">${fmtBytes(f.size)} · ${fmtDur(f.size)}${f.status === 'transcribing' && elapsed.value > 0 ? ` · ${Math.floor(elapsed.value/60)}:${String(elapsed.value%60).padStart(2,'0')}` : ''}</div>
        </div>
      </div>
      ${inProgress && html`<div class="progress-bar"><div class="progress-fill"></div></div>`}
      ${f.transcript !== null && html`
        ${isFormatting && html`
          <div class="formatting-status">
            <span class="formatting-spinner"></span>
            <span>Currently structuring transcription…</span>
          </div>
        `}
        ${hasFormatted && html`
          <div class="tx-view-toggle">
            <button class=${'btn btn-ghost btn-sm' + (viewMode === 'raw' ? ' active' : '')}
              onClick=${() => updateFile(i, { txView: 'raw' })}>Raw</button>
            <button class=${'btn btn-ghost btn-sm' + (viewMode === 'formatted' ? ' active' : '')}
              onClick=${() => updateFile(i, { txView: 'formatted' })}>Formatted</button>
            ${c.llm_formatting && html`
              <button class="btn btn-ghost btn-sm" style="margin-left:auto"
                onClick=${() => reformatFile(i)}
                disabled=${isFormatting}>Re-format</button>
            `}
          </div>
        `}
        <div class="transcript">${displayText}</div>
        <div class="tx-actions">
          ${c.notion_api_key && c.notion_target_id && html`<button class="btn btn-ghost btn-sm" onClick=${() => sendToNotion(i)}>Notion</button>`}
          ${c.obsidian_vault_name && html`<button class="btn btn-ghost btn-sm" onClick=${() => sendToObsidian(i)}>Obsidian</button>`}
          <button class="btn btn-danger btn-sm" style="margin-left:auto" onClick=${onDelete}>Delete</button>
        </div>
        ${c.notes_enabled && html`
          <textarea class="notes-area" placeholder="Notes…" rows="3"
            value=${notesDraft.value} onInput=${onNotesChange}
          ></textarea>
          <div class="notes-footer" style="justify-content:flex-end">
            <button class="btn btn-ghost btn-sm" data-mic
              disabled=${!parakeetModel || micBusy.value}
              title=${!parakeetModel ? 'Model not loaded' : recording.value ? 'Stop recording' : 'Speak a note'}
              onClick=${toggleRecording}>
              ${micBusy.value ? 'Transcribing…' : recording.value
                ? html`<${IconMicActive} /> Stop`
                : html`<${IconMic} />`}
            </button>
          </div>
        `}
        <${AtfInput} fileEntries=${f.entries || []} fileIndex=${i} showInput=${false} />
      `}
      ${f.error && html`
        <div class="error-msg">
          <span>${f.error}</span>
          <button class="btn btn-ghost btn-sm" onClick=${() => retryFile(i)}>Retry</button>
          <button class="btn btn-danger btn-sm" onClick=${onDelete}>Delete</button>
        </div>
      `}
    </div>`;
}
