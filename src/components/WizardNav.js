import { html } from '../lib.js';
import { files, wizardIndex } from '../signals.js';
import { goNext, goPrev, activeFiles } from '../navigation.js';
import { AtfInput } from './AtfInput.js';

export function WizardNav() {
  const fs       = files.value;
  const activeFs = activeFiles();
  const idx      = wizardIndex.value;
  const f        = activeFs[idx];
  const realIdx  = fs.indexOf(f);
  const inProg   = f?.status === 'converting' || f?.status === 'transcribing';
  const hasTranscript = f?.transcript !== null && f?.transcript !== undefined;
  return html`
    <div class="wizard-nav">
      ${hasTranscript && html`
        <${AtfInput} fileEntries=${f?.entries || []} fileIndex=${realIdx} showChips=${false} />
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
