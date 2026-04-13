import { html, useState, useRef } from '../lib.js';
import { ATF_MAX, ATF_TYPES } from '../config.js';
import { files, updateFile } from '../signals.js';
import { genId } from '../helpers.js';
import { parakeetModel, runParakeet } from '../engine.js';
import { prepareAudio } from '../audio.js';
import { updateTx } from '../storage.js';
import { IconMic, IconMicActive } from './icons.js';

function saveFileEntries(i, entries) {
  updateFile(i, { entries });
  const id = files.value[i]?.savedId;
  if (id) updateTx(id, { entries });
}

const randomAtfType = () => ATF_TYPES[Math.floor(Math.random() * ATF_TYPES.length)].type;

export function AtfInput({ fileEntries, fileIndex, showChips = true, showInput = true }) {
  const [draft,   setDraft]   = useState('');
  const [type,    setType]    = useState(randomAtfType);
  const [atfRec,  setAtfRec]  = useState(false);
  const [atfBusy, setAtfBusy] = useState(false);
  const atfMediaRef  = useRef(null);
  const atfChunksRef = useRef([]);

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    const entry = { id: genId(), type, text, createdAt: new Date().toISOString() };
    saveFileEntries(fileIndex, [...fileEntries, entry]);
    setDraft('');
    setType(randomAtfType());
  };

  const remove = id => saveFileEntries(fileIndex, fileEntries.filter(e => e.id !== id));

  const edit = entry => {
    setType(entry.type);
    setDraft(entry.text);
    saveFileEntries(fileIndex, fileEntries.filter(e => e.id !== entry.id));
  };
  const onKey  = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add(); } };
  const placeholder = ATF_TYPES.find(a => a.type === type)?.placeholder || '';

  const toggleAtfMic = async () => {
    if (atfRec) { atfMediaRef.current?.stop(); setAtfRec(false); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      atfChunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = e => { if (e.data.size > 0) atfChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setAtfBusy(true);
        try {
          const blob = new Blob(atfChunksRef.current, { type: mr.mimeType });
          const f32  = await prepareAudio(await blob.arrayBuffer());
          const text = await runParakeet(f32, true);  // priority — jump queue
          if (text?.trim()) setDraft(prev => prev ? `${prev} ${text.trim()}` : text.trim());
        } catch (e) { console.error('ATF mic transcription failed:', e); }
        setAtfBusy(false);
      };
      mr.start(); atfMediaRef.current = mr; setAtfRec(true);
    } catch (e) { console.error('Mic access denied:', e); }
  };

  return html`
    <div class="atf-section">
      ${showChips && ATF_TYPES.map(({ type: t, label }) => {
        const items = fileEntries.filter(e => e.type === t);
        if (!items.length) return null;
        return html`
          <div class="atf-group" key=${t}>
            <div class=${'atf-label ' + t}>${label}</div>
            ${items.map(e => html`
              <div class="atf-chip" key=${e.id}>
                <span>${e.text}</span>
                <button onClick=${() => edit(e)} title="Edit" aria-label="Edit entry" class="atf-chip-edit">✎</button>
                <button onClick=${() => remove(e.id)} title="Remove" aria-label="Remove entry">×</button>
              </div>
            `)}
          </div>`;
      })}
      ${showInput && html`
        <div class="atf-add-row">
          <select class="atf-type-select" value=${type} onChange=${e => setType(e.target.value)}>
            ${ATF_TYPES.map(({ type: t, label }) => html`<option value=${t}>${label.slice(0, -1)}</option>`)}
          </select>
          <input class="atf-input" type="text" placeholder=${placeholder}
            maxlength=${ATF_MAX} value=${draft}
            onInput=${e => setDraft(e.target.value)}
            onKeyDown=${onKey} />
          <button class="btn btn-ghost btn-sm" data-mic
            disabled=${!parakeetModel || atfBusy}
            title=${!parakeetModel ? 'Model not loaded' : atfRec ? 'Stop recording' : 'Speak an entry'}
            onClick=${toggleAtfMic}>
            ${atfBusy ? '…' : atfRec ? html`<${IconMicActive} />` : html`<${IconMic} />`}
          </button>
          <button class="btn btn-ghost btn-sm" onClick=${add} disabled=${!draft.trim()}>Add</button>
        </div>
        ${draft.length > ATF_MAX - 30 && html`<div class="atf-counter">${ATF_MAX - draft.length} left</div>`}
      `}
    </div>`;
}
