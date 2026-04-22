import { html, useSignal, effect } from '../lib.js';
import { ATF_MAX, ATF_TYPES } from '../config.js';
import { files, updateFile, atfEditEntry } from '../signals.js';
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

const rotateType = (type) => ATF_TYPES[(ATF_TYPES.findIndex(({ type: t }) => t === type ) + 1) % ATF_TYPES.length].type;

let atfMediaRef = null;
let atfChunksRef = [];

export function AtfInput({ fileEntries, fileIndex, showChips = true, showInput = true }) {
  const draft   = useSignal('');
  const type    = useSignal(randomAtfType());
  const atfRec  = useSignal(false);
  const atfBusy = useSignal(false);

  const add = () => {
    const text = draft.value.trim();
    if (!text) return;
    const entry = { id: genId(), type: type.value, text, createdAt: new Date().toISOString() };
    saveFileEntries(fileIndex, [...fileEntries, entry]);
    draft.value = '';
    type.value = randomAtfType();
  };

  const remove = id => saveFileEntries(fileIndex, fileEntries.filter(e => e.id !== id));

  const edit = entry => {
    atfEditEntry.value = { type: entry.type, text: entry.text, id: entry.id, fileIndex };
    saveFileEntries(fileIndex, fileEntries.filter(e => e.id !== entry.id));
  };

  effect(() => {
    const pending = atfEditEntry.value;
    if (!pending || pending.fileIndex !== fileIndex) return;
    type.value = pending.type;
    draft.value = pending.text;
    atfEditEntry.value = null;
  });

  const onKey  = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add(); } };
  const placeholder = ATF_TYPES.find(a => a.type === type.value)?.placeholder || '';

  const toggleAtfMic = async () => {
    if (atfRec.value) { atfMediaRef?.stop(); atfRec.value = false; return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      atfChunksRef = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = e => { if (e.data.size > 0) atfChunksRef.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        atfBusy.value = true;
        try {
          const blob = new Blob(atfChunksRef, { type: mr.mimeType });
          const f32  = await prepareAudio(await blob.arrayBuffer());
          const text = await runParakeet(f32, true);
          if (text?.trim()) draft.value = draft.value ? `${draft.value} ${text.trim()}` : text.trim();
        } catch (e) { console.error('ATF mic transcription failed:', e); }
        atfBusy.value = false;
      };
      mr.start(); atfMediaRef = mr; atfRec.value = true;
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
        <h5 class="atf-add-type">${ATF_TYPES.find(({ type: t }) => t === type.value ).label}</h5>

        <div class="atf-add-row">
          ${/* <select class="atf-type-select" value=${type.value} onChange=${e => type.value = e.target.value}>
            ${ATF_TYPES.map(({ type: t, label }) => html`<option value=${t}>${label.slice(0, -1)}</option>`)}
          </select> */ null}

          <textarea
            rows="2"
            class="atf-input"
            placeholder=${placeholder}
            maxlength=${ATF_MAX} value=${draft.value}
            onInput=${e => draft.value = e.target.value}
            onKeyDown=${onKey} />

          ${/* <button
            class="btn btn-ghost btn-sm"
            data-mic
            disabled=${!parakeetModel || atfBusy.value}
            title=${!parakeetModel ? 'Model not loaded' : atfRec.value ? 'Stop recording' : 'Speak an entry'}
            onClick=${toggleAtfMic}>
            ${atfBusy.value ? '…' : atfRec.value ? html`<${IconMicActive} />` : html`<${IconMic} />`}
          </button>  */ null}
          
          <button class="btn btn-ghost btn-sm" onClick=${() => type.value = rotateType(type.value)}>Change</button>

          <button class="btn btn-ghost btn-sm" onClick=${add} disabled=${!draft.value.trim()}>Add</button>
        </div>

        ${draft.value.length > ATF_MAX - 30 && html`<div class="atf-counter">${ATF_MAX - draft.value.length} left</div>`}
      `}
    </div>`;
}
