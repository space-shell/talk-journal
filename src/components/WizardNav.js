import { html } from '../lib.js';
import { files, wizardIndex } from '../signals.js';
import { goNext, goPrev } from '../navigation.js';
import { AtfInput } from './AtfInput.js';

export function WizardNav() {
  const idx    = wizardIndex.value;
  const f      = files.value[idx];
  const inProg = f?.status === 'converting' || f?.status === 'transcribing';
  const hasTranscript = f?.transcript !== null && f?.transcript !== undefined;
  return html`
    <div class="wizard-nav">
      ${hasTranscript && html`
        <${AtfInput} fileEntries=${f?.entries || []} fileIndex=${idx} showChips=${false} />
      `}
      <div class="wizard-nav-buttons">
        <div class="wizard-nav-side">
          ${idx > 0 && html`<button class="btn btn-ghost" onClick=${goPrev}>← Back</button>`}
        </div>
        <button class=${'btn btn-primary' + (inProg ? ' btn-pulsing' : '')}
          disabled=${inProg} onClick=${goNext}>
          ${inProg ? 'Transcribing…' : 'Complete'}
        </button>
        <div class="wizard-nav-side"></div>
      </div>
    </div>`;
}
