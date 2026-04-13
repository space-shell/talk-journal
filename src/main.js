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

render(hasFilePicker ? html`<${App} />` : html`<${CompatWarning} />`, document.getElementById('root'));
autoSync();
