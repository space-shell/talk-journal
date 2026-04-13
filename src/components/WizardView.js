import { html } from '../lib.js';
import { files, wizardIndex } from '../signals.js';
import { fmtDay } from '../helpers.js';
import { FileItem } from './FileItem.js';

export function WizardView() {
  const fs           = files.value;
  const idx          = wizardIndex.value;
  const f            = fs[idx];
  if (!f) return null;
  // Progress based on all reviewable files (including completed), so it only increases
  const reviewable   = fs.filter(x => !x.deleted && x.status !== 'cleared');
  const completedCnt = reviewable.filter(x => x.completed).length;
  const totalCnt     = reviewable.length;
  const overallPos   = reviewable.indexOf(f);
  const pct          = totalCnt > 0 ? Math.round((completedCnt / totalCnt) * 100) : 0;
  return html`
    <div>
      <div class="wizard-progress-wrap"><div class="wizard-progress-fill" style=${'width:' + pct + '%'}></div></div>
      <div class="wizard-meta">
        <span>Recording ${overallPos + 1} of ${totalCnt}</span>
        <span>${fmtDay(f.mtime)}</span>
      </div>
      <${FileItem} key=${idx} f=${f} i=${idx} />
    </div>`;
}
