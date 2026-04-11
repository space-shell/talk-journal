import { html } from '../lib.js';
import { files, wizardIndex } from '../signals.js';
import { fmtDay } from '../helpers.js';
import { FileItem } from './FileItem.js';

export function WizardView() {
  const fs  = files.value;
  const idx = wizardIndex.value;
  const f   = fs[idx];
  if (!f) return null;
  const pct = Math.round(((idx + 1) / fs.length) * 100);
  return html`
    <div>
      <div class="wizard-progress-wrap"><div class="wizard-progress-fill" style=${'width:' + pct + '%'}></div></div>
      <div class="wizard-meta">
        <span>Recording ${idx + 1} of ${fs.length}</span>
        <span>${fmtDay(f.mtime)}</span>
      </div>
      <${FileItem} key=${idx} f=${f} i=${idx} />
    </div>`;
}
