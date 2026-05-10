import { render, html } from './lib.js';
import { hasFilePicker } from './compat.js';
import { files, cfg, busy, historyEntries, appView, wizardIndex } from './signals.js';
import { parakeetModel, parakeetWorker, setParakeetModel } from './engine.js';
import { App } from './components/App.js';
import { CompatWarning } from './components/CompatWarning.js';
import { autoSync, nostrStatus, pushEntry, pullAll, syncNow, pushPending, setPublishEvent, setFetchEntries } from './nostr-sync.js';
import { saveTx, removeTx } from './storage.js';
import { loadPrivkey, loadNsec, saveNsec, clearPrivkey, generateKeypair, npubFromNsec } from './nostr-keys.js';
import { loadRelays, saveRelays, relayStatuses, connectRelays } from './nostr-relay.js';
import { buildEntryEvent, buildSettingsEvent, decodeEntryEvent, getDTag } from './nostr-events.js';
import { NOSTR_D_PREFIX, NOSTR_APP_TAG, NOSTR_SETTINGS_D } from './config.js';
import { checkModelStatus } from './model.js';
import { refreshHistory, refreshStorage } from './storage.js';
import { tryAutoReconnect } from './drive.js';
import { loadLlm, isLlmReady } from './llm.js';
import { llmStatus, llmDlProgress } from './signals.js';

// Test hooks — used by tests/notes-features.test.js and tests/nostr-sync.test.js
window._tj = {
  files, cfg, busy, historyEntries, appView, wizardIndex,
  get parakeetModel()  { return parakeetModel; },
  set parakeetModel(v) { setParakeetModel(v); },
  get parakeetWorker() { return parakeetWorker; },
  nostr: {
    // signals
    get nostrStatus()    { return nostrStatus; },
    get relayStatuses()  { return relayStatuses; },
    // sync
    pushEntry, pullAll, syncNow, pushPending,
    // storage (for triggering hooks in tests)
    saveTx, removeTx,
    // keys
    loadPrivkey, loadNsec, saveNsec, clearPrivkey, generateKeypair, npubFromNsec,
    // relay
    loadRelays, saveRelays, connectRelays,
    setPublishEvent, setFetchEntries,
    // events
    buildEntryEvent, buildSettingsEvent, decodeEntryEvent, getDTag,
    // constants
    NOSTR_D_PREFIX, NOSTR_APP_TAG, NOSTR_SETTINGS_D,
  },
};

checkModelStatus();
refreshHistory();
refreshStorage();
tryAutoReconnect();

if (cfg.value.llm_formatting && localStorage.getItem('llm_model_ready') === 'true') {
  llmStatus.value = { loaded: false, loading: true, error: null };
  loadLlm(p => {
    if (!p) return;
    const pct = typeof p === 'number' ? p : p.progress != null ? p.progress : null;
    llmDlProgress.value = {
      visible: true,
      pct: pct != null ? Math.min(99, pct) : llmDlProgress.value.pct,
      label: p.text || 'Loading AI model…',
    };
  }).then(() => {
    llmDlProgress.value = { visible: false, pct: 0, label: '' };
    llmStatus.value = { loaded: true, loading: false, error: null };
  }).catch(e => {
    llmDlProgress.value = { visible: false, pct: 0, label: '' };
    llmStatus.value = { loaded: false, loading: false, error: e.message };
    console.warn('LLM auto-load failed:', e);
  });
}

render(hasFilePicker ? html`<${App} />` : html`<${CompatWarning} />`, document.getElementById('root'));
autoSync();
