import { html } from '../lib.js';
import { files, wizardIndex } from '../signals.js';
import { goNext, goPrev, activeFiles } from '../navigation.js';

export function WizardNav() {
  const activeFs = activeFiles();
  const idx      = wizardIndex.value;
  const f        = activeFs[idx];
  const inProg   = f?.status === 'converting' || f?.status === 'transcribing';
  return html`
    <div class="wizard-nav">
      ${idx > 0
        ? html`<button class="btn btn-ghost" onClick=${goPrev}>← Back</button>`
        : html`<div></div>`}
      <span class="wizard-nav-center">${idx + 1} / ${activeFs.length}</span>
      <button class=${'btn btn-primary' + (inProg ? ' btn-pulsing' : '')}
        disabled=${inProg} onClick=${goNext}>
        ${inProg ? 'Transcribing…' : 'Complete'}
      </button>
    </div>`;
}
