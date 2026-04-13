import { html } from '../lib.js';
import { files, wizardIndex } from '../signals.js';
import { activeFiles } from '../navigation.js';
import { fmtDay } from '../helpers.js';
import { FileItem } from './FileItem.js';

export function WizardView() {
  const fs       = files.value;
  const activeFs = activeFiles();
  const idx      = wizardIndex.value;
  const f        = activeFs[idx];
  if (!f) return null;
  const realIdx  = fs.indexOf(f);
  const pct      = Math.round(((idx + 1) / activeFs.length) * 100);
  return html`
    <div>
      <div class="wizard-progress-wrap"><div class="wizard-progress-fill" style=${'width:' + pct + '%'}></div></div>
      <div class="wizard-meta">
        <span>Recording ${idx + 1} of ${activeFs.length}</span>
        <span>${fmtDay(f.mtime)}</span>
      </div>
      <${FileItem} key=${realIdx} f=${f} i=${realIdx} />
    </div>`;
}
