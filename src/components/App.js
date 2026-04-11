import { html, useEffect } from '../lib.js';
import { appView, webgpuNoticeVis } from '../signals.js';
import { checkModelStatus } from '../model.js';
import { refreshHistory, refreshStorage } from '../storage.js';
import { tryAutoReconnect } from '../drive.js';
import { SettingsDrawer } from './SettingsDrawer.js';
import { Header } from './Header.js';
import { ModelPanel } from './ModelPanel.js';
import { FilesPanel } from './FilesPanel.js';
import { WizardView } from './WizardView.js';
import { WizardNav } from './WizardNav.js';
import { SummaryPage } from './SummaryPage.js';
import { ActionBar } from './ActionBar.js';

export function App() {
  useEffect(() => {
    checkModelStatus();
    refreshHistory();
    refreshStorage();
    tryAutoReconnect();
  }, []);

  const view = appView.value;

  return html`
    <div id="app" style="display:flex;flex-direction:column">
      <${SettingsDrawer} />
      <${Header} />
      <main>
        ${view === 'home' && html`
          <${ModelPanel} />
          ${webgpuNoticeVis.value && html`
            <div class="notice warn inline-notice">
              <span>WebGPU not available — using WASM mode (~650 MB). Transcription will work but may be slower.</span>
            </div>
          `}
          <${FilesPanel} />
        `}
        ${view === 'wizard'  && html`<${WizardView} />`}
        ${view === 'summary' && html`<${SummaryPage} />`}
      </main>
      ${view === 'home'   && html`<${ActionBar} />`}
      ${view === 'wizard' && html`<${WizardNav} />`}
    </div>`;
}
