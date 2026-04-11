import { render, html } from './lib.js';
import { hasFilePicker } from './compat.js';
import { files, cfg, busy, historyEntries, appView, wizardIndex } from './signals.js';
import { parakeetModel, parakeetWorker, setParakeetModel } from './engine.js';
import { App } from './components/App.js';
import { CompatWarning } from './components/CompatWarning.js';

// Test hooks — used by tests/notes-features.test.js
window._tj = {
  files, cfg, busy, historyEntries, appView, wizardIndex,
  get parakeetModel()  { return parakeetModel; },
  set parakeetModel(v) { setParakeetModel(v); },
  get parakeetWorker() { return parakeetWorker; },
};

render(hasFilePicker ? html`<${App} />` : html`<${CompatWarning} />`, document.getElementById('root'));
