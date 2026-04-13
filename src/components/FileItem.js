import { html, useState, useEffect, useRef } from '../lib.js';
import { files, updateFile, cfg } from '../signals.js';
import { fmtBytes, fmtDur, fmtTime } from '../helpers.js';
import { removeTx, updateTx, refreshHistory, refreshStorage } from '../storage.js';
import { retryFile } from '../transcription.js';
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

export function FileItem({ f, i }) {
  const [notesDraft, setNotesDraft] = useState(f.notes || '');
  const [recording,  setRecording]  = useState(false);
  const [micBusy,    setMicBusy]    = useState(false);
  const [elapsed,    setElapsed]    = useState(0);
  const mediaRecRef   = useRef(null);
  const chunksRef     = useRef([]);
  const notesTimerRef = useRef(null);
  const elapsedRef    = useRef(null);

  useEffect(() => {
    if (f.status === 'transcribing') {
      setElapsed(0);
      elapsedRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      clearInterval(elapsedRef.current);
    }
    return () => clearInterval(elapsedRef.current);
  }, [f.status]);

  const [bc, bl]   = BADGE_MAP[f.status] || BADGE_MAP.pending;
  const inProgress = f.status === 'converting' || f.status === 'transcribing';
  const c          = cfg.value;

  const persistNotes = text => {
    updateFile(i, { notes: text });
    if (f.savedId) updateTx(f.savedId, { notes: text });
  };

  const onNotesChange = e => {
    const text = e.target.value;
    setNotesDraft(text);
    clearTimeout(notesTimerRef.current);
    notesTimerRef.current = setTimeout(() => persistNotes(text), 800);
  };

  const toggleRecording = async () => {
    if (recording) { mediaRecRef.current?.stop(); setRecording(false); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setMicBusy(true);
        try {
          const blob = new Blob(chunksRef.current, { type: mr.mimeType });
          const f32  = await prepareAudio(await blob.arrayBuffer());
          const text = await runParakeet(f32, true);  // priority — jump queue
          if (text?.trim()) {
            const next = notesDraft ? `${notesDraft} ${text.trim()}` : text.trim();
            setNotesDraft(next);
            persistNotes(next);
          }
        } catch (e) { console.error('Mic transcription failed:', e); }
        setMicBusy(false);
      };
      mr.start(); mediaRecRef.current = mr; setRecording(true);
    } catch (e) { console.error('Mic access denied:', e); }
  };

  const onDelete = () => {
    if (!confirm('Remove this transcription? The source file is not affected.')) return;
    if (f.savedId) removeTx(f.savedId);
    if (f.deleted) {
      files.value = files.value.filter((_, idx) => idx !== i);
    } else {
      updateFile(i, { transcript: null, status: 'cleared', savedId: null, notes: '', entries: [] });
      setNotesDraft('');
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
          <div class="file-meta">${fmtBytes(f.size)} · ${fmtDur(f.size)}${f.status === 'transcribing' && elapsed > 0 ? ` · ${Math.floor(elapsed/60)}:${String(elapsed%60).padStart(2,'0')}` : ''}</div>
        </div>
      </div>
      ${inProgress && html`<div class="progress-bar"><div class="progress-fill"></div></div>`}
      ${f.transcript !== null && html`
        <div class="transcript">${f.transcript}</div>
        <div class="tx-actions">
          ${c.notion_api_key && c.notion_target_id && html`<button class="btn btn-ghost btn-sm" onClick=${() => sendToNotion(i)}>Notion</button>`}
          ${c.obsidian_vault_name && html`<button class="btn btn-ghost btn-sm" onClick=${() => sendToObsidian(i)}>Obsidian</button>`}
          <button class="btn btn-danger btn-sm" style="margin-left:auto" onClick=${onDelete}>Delete</button>
        </div>
        ${c.notes_enabled && html`
          <textarea class="notes-area" placeholder="Notes…" rows="3"
            value=${notesDraft} onInput=${onNotesChange}
          ></textarea>
          <div class="notes-footer" style="justify-content:flex-end">
            <button class="btn btn-ghost btn-sm" data-mic
              disabled=${!parakeetModel || micBusy}
              title=${!parakeetModel ? 'Model not loaded' : recording ? 'Stop recording' : 'Speak a note'}
              onClick=${toggleRecording}>
              ${micBusy ? 'Transcribing…' : recording
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
