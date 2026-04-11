import { html } from '../lib.js';
import { pickDrive } from '../drive.js';
import { IconFolder } from './icons.js';

export function FilesPanel() {
  return html`
    <div class="panel">
      <div class="panel-head">
        <div>
          <div class="panel-title">Start a session</div>
          <div class="panel-meta">Select a folder of recordings to begin</div>
        </div>
        <button class="btn btn-primary" onClick=${pickDrive}>
          <${IconFolder} /> Select Folder
        </button>
      </div>
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
