import { html } from '../lib.js';
import { files, wizardIndex } from '../signals.js';
import { goNext, goPrev } from '../navigation.js';

export function WizardNav() {
  const fs     = files.value;
  const idx    = wizardIndex.value;
  const f      = fs[idx];
  const isLast = idx === fs.length - 1;
  const inProg = f?.status === 'converting' || f?.status === 'transcribing';
  return html`
    <div class="wizard-nav">
      ${idx > 0
        ? html`<button class="btn btn-ghost" onClick=${goPrev}>← Back</button>`
        : html`<div></div>`}
      <span class="wizard-nav-center">${idx + 1} / ${fs.length}</span>
      <button class=${'btn btn-primary' + (inProg ? ' btn-pulsing' : '')}
        disabled=${inProg} onClick=${goNext}>
        ${inProg ? 'Transcribing…' : isLast ? 'Finish →' : 'Next →'}
      </button>
    </div>`;
}
