import { html } from '../lib.js';
import { files, busy } from '../signals.js';
import { requestBatch } from '../transcription.js';
import { exportAll, shareAll } from '../share.js';
import { IconPlay } from './icons.js';

export function ActionBar() {
  const fs     = files.value;
  const isBusy = busy.value;
  if (!fs.length) return null;
  const hasDone     = fs.some(f => f.transcript !== null);
  const allSelected = fs.every(f => f.selected);
  return html`
    <div class="action-bar">
      <button class="btn btn-ghost btn-sm" style="white-space:nowrap"
        onClick=${() => { files.value = fs.map(f => ({ ...f, selected: !allSelected })); }}>
        ${allSelected ? 'Deselect all' : 'Select all'}
      </button>
      <button class=${'btn btn-primary' + (isBusy ? ' btn-pulsing' : '')} disabled=${isBusy || !fs.some(f => f.selected)} onClick=${requestBatch}>
        <${IconPlay} /> Transcribe Selected
      </button>
      <button class="btn btn-ghost" disabled=${!hasDone} onClick=${() => exportAll('txt')}>.txt</button>
      <button class="btn btn-ghost" disabled=${!hasDone} onClick=${() => exportAll('md')}>.md</button>
      ${navigator.share && html`<button class="btn btn-ghost" onClick=${shareAll}>Share</button>`}
    </div>`;
}
