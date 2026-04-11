import { html } from '../lib.js';
import { modelStatus, settingsOpen } from '../signals.js';
import { refreshStorage } from '../storage.js';
import { IconGear } from './icons.js';

export function Header() {
  const ms = modelStatus.value;
  return html`
    <header>
      <h1>Tibbs</h1>
      <div style="display:flex;align-items:center;gap:.75rem">
        <div class="model-status">
          <div class=${'model-dot' + (ms.dot ? ' ' + ms.dot : '')}></div>
          <span>${ms.label}</span>
        </div>
        <button class="icon-btn" aria-label="Settings" onClick=${() => { settingsOpen.value = true; refreshStorage(); }}>
          <${IconGear} /> <span>Settings</span>
        </button>
      </div>
    </header>`;
}
