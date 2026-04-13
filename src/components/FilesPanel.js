import { html } from '../lib.js';
import { historyEntries } from '../signals.js';
import { pickDrive } from '../drive.js';
import { resumeSession } from '../navigation.js';
import { IconFolder } from './icons.js';

export function FilesPanel() {
  const history    = historyEntries.value;
  const incomplete = history.filter(e => !e.completed && !e.deleted);
  const totalAtf   = history.reduce((s, e) => s + (e.entries?.length || 0), 0);
  const totalMins  = Math.round(history.reduce((s, e) => s + (e.durationSeconds || 0), 0) / 60);

  return html`
    <div class="panel">
      <div class="panel-head">
        <div>
          <div class="panel-title">Start a session</div>
          <div class="panel-meta">Select a folder of recordings to begin</div>
        </div>
        <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;justify-content:flex-end">
          ${incomplete.length > 0 && html`
            <button class="btn btn-ghost" onClick=${resumeSession}>Resume (${incomplete.length})</button>
          `}
          <button class="btn btn-primary" onClick=${pickDrive}>
            <${IconFolder} /> Select Folder
          </button>
        </div>
      </div>
      ${(totalAtf > 0 || totalMins > 0) && html`
        <div class="summary-stats" style="padding:0 1rem 1rem">
          <div class="summary-stat">
            <div class="summary-stat-value">${totalAtf.toLocaleString()}</div>
            <div class="summary-stat-label">Total entries</div>
          </div>
          <div class="summary-stat">
            <div class="summary-stat-value">${totalMins.toLocaleString()}</div>
            <div class="summary-stat-label">Minutes journaled</div>
          </div>
        </div>
      `}
      <div class="workflow-steps">
        <div class="workflow-step">
          <div class="workflow-step-num">1</div>
          <div class="workflow-step-text">Select a folder containing your recordings — any audio format works</div>
        </div>
        <div class="workflow-step">
          <div class="workflow-step-num">2</div>
          <div class="workflow-step-text">Review each recording one at a time while transcription runs in the background</div>
        </div>
        <div class="workflow-step">
          <div class="workflow-step-num">3</div>
          <div class="workflow-step-text">Add notes, actions, thoughts, and feelings to each entry, then finish to see your session summary</div>
        </div>
      </div>
    </div>`;
}
