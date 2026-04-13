/**
 * Behavioural tests for Nostr sync feature
 *
 * Groups:
 *   A — Key management      (nostr-keys.js)
 *   B — Encryption          (nostr-keys.js encrypt/decrypt)
 *   C — Event building      (nostr-events.js)
 *   D — Relay persistence   (nostr-relay.js localStorage layer)
 *   E — Sync state machine  (nostr-sync.js)
 *
 * Run via Chrome DevTools evaluate_script on the live app page,
 * or paste into the browser console.
 *
 * Requires window._tj.nostr hooks exposed by src/main.js.
 */

(async function runNostrTests() {
  const results = [];

  // ── Helpers ──────────────────────────────────────────────────────────────

  function assert(condition, msg) {
    if (!condition) throw new Error(msg || 'Assertion failed');
  }

  async function test(name, fn) {
    try {
      await fn();
      results.push({ status: 'PASS', name, error: '' });
    } catch (e) {
      results.push({ status: 'FAIL', name, error: e.message });
    }
  }

  const n = window._tj?.nostr;
  assert(n, 'window._tj.nostr not found — ensure the app exposes test hooks');

  // Stable test keypair — generated once for the suite so deterministic tests work
  const KP = n.generateKeypair();

  // Seed localStorage with a valid nsec and a known relay list for tests that need them
  function seedNostrConfig() {
    n.saveNsec(KP.nsec);
    n.saveRelays(['wss://stub.invalid']);
  }

  function cleanNostrConfig() {
    n.clearPrivkey();
    n.saveRelays([]);
    localStorage.removeItem('tj_nostr_pending');
    localStorage.removeItem('tj_nostr_last_sync');
  }

  function makeTxEntry(overrides = {}) {
    return {
      id:              'test-uuid-' + Math.random().toString(36).slice(2),
      filename:        'test.wav',
      transcribedAt:   new Date().toISOString(),
      durationSeconds: 10,
      text:            'Hello world',
      silenceRemoved:  false,
      deleted:         false,
      notes:           '',
      entries:         [],
      ...overrides,
    };
  }

  // Remove any tx entries written by tests
  const _testUuids = [];
  function saveTxEntry(entry) {
    _testUuids.push(entry.id);
    // Write directly to localStorage in the same format storage.js uses
    const idx = JSON.parse(localStorage.getItem('transcription:index') || '[]');
    if (!idx.includes(entry.id)) idx.unshift(entry.id);
    localStorage.setItem('transcription:index', JSON.stringify(idx));
    localStorage.setItem(`transcription:${entry.id}`, JSON.stringify(entry));
  }
  function cleanTxEntries() {
    _testUuids.forEach(id => {
      localStorage.removeItem(`transcription:${id}`);
      const idx = JSON.parse(localStorage.getItem('transcription:index') || '[]');
      localStorage.setItem('transcription:index', JSON.stringify(idx.filter(x => x !== id)));
    });
    _testUuids.length = 0;
  }

  // ── Group A: Key management ───────────────────────────────────────────────

  await test('A-1: generateKeypair returns nsec1… and npub1… strings', () => {
    const kp = n.generateKeypair();
    assert(typeof kp.nsec === 'string' && kp.nsec.startsWith('nsec1'),
      `nsec should start with nsec1, got: ${kp.nsec?.slice(0, 10)}`);
    assert(typeof kp.npub === 'string' && kp.npub.startsWith('npub1'),
      `npub should start with npub1, got: ${kp.npub?.slice(0, 10)}`);
    assert(kp.privkey instanceof Uint8Array && kp.privkey.length === 32,
      'privkey should be a 32-byte Uint8Array');
  });

  await test('A-2: saveNsec / loadNsec round-trips through localStorage', () => {
    n.saveNsec(KP.nsec);
    assert(n.loadNsec() === KP.nsec, 'loadNsec should return the saved nsec');
    n.clearPrivkey();
  });

  await test('A-3: saveNsec throws on invalid input; loadPrivkey returns null after bad value', () => {
    let threw = false;
    try { n.saveNsec('not-a-valid-nsec'); } catch { threw = true; }
    assert(threw, 'saveNsec should throw on invalid nsec');
    // Ensure localStorage was not corrupted
    assert(n.loadPrivkey() === null, 'loadPrivkey should return null after invalid save attempt');
  });

  await test('A-4: loadPrivkey returns a 32-byte Uint8Array for a valid nsec', () => {
    n.saveNsec(KP.nsec);
    const pk = n.loadPrivkey();
    assert(pk instanceof Uint8Array, 'loadPrivkey should return Uint8Array');
    assert(pk.length === 32, `Expected 32 bytes, got ${pk.length}`);
    n.clearPrivkey();
  });

  await test('A-5: clearPrivkey removes key; loadNsec returns empty string', () => {
    n.saveNsec(KP.nsec);
    n.clearPrivkey();
    assert(n.loadNsec() === '', `Expected empty string, got "${n.loadNsec()}"`);
    assert(n.loadPrivkey() === null, 'loadPrivkey should return null after clearPrivkey');
  });

  await test('A-6: npubFromNsec is deterministic — same nsec always yields same npub', () => {
    const npub1 = n.npubFromNsec(KP.nsec);
    const npub2 = n.npubFromNsec(KP.nsec);
    assert(npub1 === npub2, 'npubFromNsec should be deterministic');
    assert(npub1 === KP.npub, 'npubFromNsec result should match generateKeypair npub');
  });

  // ── Group B: Encryption ───────────────────────────────────────────────────

  // Access encrypt/decrypt via a built event's round-trip (they're not directly on _tj.nostr
  // but are exercised fully by buildEntryEvent / decodeEntryEvent)

  await test('B-1: encrypt/decrypt round-trip via buildEntryEvent + decodeEntryEvent', () => {
    const entry  = makeTxEntry({ text: 'secret transcript' });
    const privkey = KP.privkey;
    const event   = n.buildEntryEvent(entry, privkey);
    const decoded = n.decodeEntryEvent(event, privkey);
    assert(decoded !== null, 'decodeEntryEvent should not return null');
    assert(decoded.text === 'secret transcript', `Expected "secret transcript", got "${decoded.text}"`);
  });

  await test('B-2: decodeEntryEvent returns null when decrypted with a different privkey', () => {
    const entry   = makeTxEntry();
    const kp2     = n.generateKeypair();
    const event   = n.buildEntryEvent(entry, KP.privkey);
    const decoded = n.decodeEntryEvent(event, kp2.privkey);
    assert(decoded === null, 'Decoding with wrong key should return null');
  });

  await test('B-3: encrypting the same plaintext twice produces different ciphertext (NIP-44 nonce)', () => {
    const entry = makeTxEntry({ text: 'same content' });
    const ev1   = n.buildEntryEvent(entry, KP.privkey);
    const ev2   = n.buildEntryEvent(entry, KP.privkey);
    assert(ev1.content !== ev2.content, 'NIP-44 should produce different ciphertext on each call');
  });

  // ── Group C: Event building ───────────────────────────────────────────────

  await test('C-1: buildEntryEvent produces kind 30078', () => {
    const ev = n.buildEntryEvent(makeTxEntry(), KP.privkey);
    assert(ev.kind === 30078, `Expected kind 30078, got ${ev.kind}`);
  });

  await test('C-2: d tag is tibbs:entry:<uuid>', () => {
    const entry = makeTxEntry({ id: 'my-test-id' });
    const ev    = n.buildEntryEvent(entry, KP.privkey);
    const dTag  = n.getDTag(ev);
    assert(dTag === `${n.NOSTR_D_PREFIX}my-test-id`,
      `Expected d-tag "${n.NOSTR_D_PREFIX}my-test-id", got "${dTag}"`);
  });

  await test('C-3: t tag is "tibbs"', () => {
    const ev    = n.buildEntryEvent(makeTxEntry(), KP.privkey);
    const tTag  = ev.tags.find(t => t[0] === 't')?.[1];
    assert(tTag === n.NOSTR_APP_TAG, `Expected t-tag "${n.NOSTR_APP_TAG}", got "${tTag}"`);
  });

  await test('C-4: event content is NIP-44 ciphertext, not raw JSON', () => {
    const ev = n.buildEntryEvent(makeTxEntry({ text: 'hello' }), KP.privkey);
    let parsedOk = false;
    try { const p = JSON.parse(ev.content); parsedOk = typeof p === 'object' && p !== null && 'text' in p; } catch {}
    assert(!parsedOk, 'Content should be encrypted ciphertext, not a plain JSON object with a text field');
  });

  await test('C-5: decodeEntryEvent recovers the original entry fields', () => {
    const entry   = makeTxEntry({ text: 'recover me', notes: 'a note' });
    const ev      = n.buildEntryEvent(entry, KP.privkey);
    const decoded = n.decodeEntryEvent(ev, KP.privkey);
    assert(decoded.text === entry.text, `text mismatch: ${decoded.text}`);
    assert(decoded.notes === entry.notes, `notes mismatch: ${decoded.notes}`);
    assert(decoded.id === entry.id, `id mismatch: ${decoded.id}`);
  });

  await test('C-6: decodeEntryEvent returns null when content is not valid ciphertext', () => {
    const ev  = n.buildEntryEvent(makeTxEntry(), KP.privkey);
    const bad = { ...ev, content: 'this-is-not-ciphertext' };
    assert(n.decodeEntryEvent(bad, KP.privkey) === null, 'Should return null for invalid ciphertext');
  });

  await test('C-7: getDTag extracts the d tag value', () => {
    const ev = n.buildEntryEvent(makeTxEntry({ id: 'abc123' }), KP.privkey);
    assert(n.getDTag(ev).endsWith('abc123'), `getDTag should include entry id`);
  });

  await test('C-8: buildEntryEvent includes id, pubkey, sig (finalizeEvent ran)', () => {
    const ev = n.buildEntryEvent(makeTxEntry(), KP.privkey);
    assert(typeof ev.id     === 'string' && ev.id.length     === 64, 'id should be 64-char hex');
    assert(typeof ev.pubkey === 'string' && ev.pubkey.length === 64, 'pubkey should be 64-char hex');
    assert(typeof ev.sig    === 'string' && ev.sig.length    === 128, 'sig should be 128-char hex');
  });

  // ── Group D: Relay persistence ────────────────────────────────────────────

  await test('D-1: saveRelays / loadRelays round-trips an array of URLs', () => {
    const urls = ['wss://relay.damus.io', 'wss://nos.lol'];
    n.saveRelays(urls);
    const loaded = n.loadRelays();
    assert(JSON.stringify(loaded) === JSON.stringify(urls),
      `Expected ${JSON.stringify(urls)}, got ${JSON.stringify(loaded)}`);
    n.saveRelays([]);
  });

  await test('D-2: loadRelays returns [] when key is absent', () => {
    localStorage.removeItem('tj_nostr_relays');
    const loaded = n.loadRelays();
    assert(Array.isArray(loaded) && loaded.length === 0, 'Should return empty array when key absent');
  });

  await test('D-3: relayStatuses signal is a Map', () => {
    const m = n.relayStatuses.value;
    assert(m instanceof Map, 'relayStatuses.value should be a Map');
  });

  // ── Group E: Sync state machine ───────────────────────────────────────────

  await test('E-1: nostrStatus initial/idle state has correct shape', () => {
    const s = n.nostrStatus.value;
    assert('state' in s, 'nostrStatus should have a state property');
    assert('error' in s, 'nostrStatus should have an error property');
    assert('lastSync' in s, 'nostrStatus should have a lastSync property');
    assert(['idle', 'syncing', 'error'].includes(s.state),
      `Unexpected state value: ${s.state}`);
  });

  await test('E-2: pushEntry with no privkey configured is a no-op (does not throw)', async () => {
    cleanNostrConfig();
    let threw = false;
    try { await n.pushEntry(makeTxEntry()); } catch { threw = true; }
    assert(!threw, 'pushEntry should not throw when no privkey is configured');
  });

  await test('E-3: pushEntry adds UUID to tj_nostr_pending when publish fails', async () => {
    cleanNostrConfig();
    seedNostrConfig();
    localStorage.removeItem('tj_nostr_pending');
    const entry = makeTxEntry({ id: 'pending-test-id' });
    n.setPublishEvent(async () => { throw new Error('Relay down'); });
    try {
      await n.pushEntry(entry);
      const pending = JSON.parse(localStorage.getItem('tj_nostr_pending') || '[]');
      assert(pending.includes('pending-test-id'),
        `Expected pending-test-id in pending list, got: ${JSON.stringify(pending)}`);
    } finally {
      n.setPublishEvent(null); // restore to real implementation
      cleanNostrConfig();
    }
  });

  await test('E-4: pushEntry removes UUID from tj_nostr_pending on success', async () => {
    cleanNostrConfig();
    seedNostrConfig();
    const entry = makeTxEntry({ id: 'success-test-id' });
    // Seed the pending list
    localStorage.setItem('tj_nostr_pending', JSON.stringify(['success-test-id']));
    n.setPublishEvent(async () => [{ url: 'wss://stub.invalid', ok: true, message: '' }]);
    try {
      await n.pushEntry(entry);
      const pending = JSON.parse(localStorage.getItem('tj_nostr_pending') || '[]');
      assert(!pending.includes('success-test-id'),
        `success-test-id should have been removed from pending, got: ${JSON.stringify(pending)}`);
    } finally {
      n.setPublishEvent(null);
      cleanNostrConfig();
    }
  });

  await test('E-5: pullAll with no privkey is a no-op; nostrStatus stays idle', async () => {
    cleanNostrConfig();
    const before = n.nostrStatus.value.state;
    await n.pullAll();
    assert(n.nostrStatus.value.state !== 'syncing', 'Should not enter syncing state without privkey');
    assert(n.nostrStatus.value.state === 'idle' || before === n.nostrStatus.value.state,
      'nostrStatus should remain idle');
  });

  await test('E-6: pullAll saves a new remote entry to localStorage', async () => {
    cleanNostrConfig();
    seedNostrConfig();
    const remoteEntry = makeTxEntry({ id: 'remote-new-id', text: 'From relay' });
    _testUuids.push(remoteEntry.id);
    const privkey = n.loadPrivkey();
    const fakeEvent = {
      ...n.buildEntryEvent(remoteEntry, privkey),
      created_at: Math.floor(Date.now() / 1000),
    };
    // Patch d-tag to ensure it matches
    fakeEvent.tags = [
      ['d', `${n.NOSTR_D_PREFIX}${remoteEntry.id}`],
      ['t', n.NOSTR_APP_TAG],
    ];
    fakeEvent.content = n.buildEntryEvent(remoteEntry, privkey).content;

    n.setFetchEntries(async () => [fakeEvent]);
    try {
      await n.pullAll();
      const stored = localStorage.getItem(`transcription:${remoteEntry.id}`);
      assert(stored !== null, `transcription:${remoteEntry.id} should have been saved to localStorage`);
      const parsed = JSON.parse(stored);
      assert(parsed.text === 'From relay', `Expected "From relay", got "${parsed.text}"`);
    } finally {
      n.setFetchEntries(null);
      cleanNostrConfig();
      cleanTxEntries();
    }
  });

  await test('E-7: pullAll updates existing entry when remote created_at is newer', async () => {
    cleanNostrConfig();
    seedNostrConfig();
    const id    = 'conflict-newer-id';
    const older = makeTxEntry({ id, text: 'old text', _nostrAt: 1000 });
    saveTxEntry(older);

    const privkey = n.loadPrivkey();
    const newer   = { ...older, text: 'updated text' };
    const ev      = n.buildEntryEvent(newer, privkey);
    // Ensure created_at is newer than _nostrAt
    ev.created_at = 9999999999;
    ev.tags = [['d', `${n.NOSTR_D_PREFIX}${id}`], ['t', n.NOSTR_APP_TAG]];

    n.setFetchEntries(async () => [ev]);
    try {
      await n.pullAll();
      const stored = JSON.parse(localStorage.getItem(`transcription:${id}`));
      assert(stored.text === 'updated text',
        `Expected "updated text" after remote update, got "${stored.text}"`);
    } finally {
      n.setFetchEntries(null);
      cleanNostrConfig();
      cleanTxEntries();
    }
  });

  await test('E-8: pullAll does NOT overwrite entry when local _nostrAt is newer', async () => {
    cleanNostrConfig();
    seedNostrConfig();
    const id    = 'conflict-older-id';
    const local = makeTxEntry({ id, text: 'local wins', _nostrAt: 9999999999 });
    saveTxEntry(local);

    const privkey = n.loadPrivkey();
    const remote  = { ...local, text: 'remote loses' };
    const ev      = n.buildEntryEvent(remote, privkey);
    ev.created_at = 1000; // older than local._nostrAt
    ev.tags = [['d', `${n.NOSTR_D_PREFIX}${id}`], ['t', n.NOSTR_APP_TAG]];

    n.setFetchEntries(async () => [ev]);
    try {
      await n.pullAll();
      const stored = JSON.parse(localStorage.getItem(`transcription:${id}`));
      assert(stored.text === 'local wins',
        `Local entry should not have been overwritten, got "${stored.text}"`);
    } finally {
      n.setFetchEntries(null);
      cleanNostrConfig();
      cleanTxEntries();
    }
  });

  await test('E-9: pullAll sets tj_nostr_last_sync on success', async () => {
    cleanNostrConfig();
    seedNostrConfig();
    localStorage.removeItem('tj_nostr_last_sync');
    n.setFetchEntries(async () => []);
    try {
      await n.pullAll();
      const ts = localStorage.getItem('tj_nostr_last_sync');
      assert(ts !== null, 'tj_nostr_last_sync should be set after successful pull');
      assert(!isNaN(Date.parse(ts)), `tj_nostr_last_sync should be a valid ISO timestamp, got "${ts}"`);
    } finally {
      n.setFetchEntries(null);
      cleanNostrConfig();
    }
  });

  await test('E-10: pullAll sets nostrStatus.state to "error" when fetchEntries throws', async () => {
    cleanNostrConfig();
    seedNostrConfig();
    n.setFetchEntries(async () => { throw new Error('Network failure'); });
    try {
      await n.pullAll();
      assert(n.nostrStatus.value.state === 'error',
        `Expected state "error", got "${n.nostrStatus.value.state}"`);
      assert(n.nostrStatus.value.error === 'Network failure',
        `Expected error message "Network failure", got "${n.nostrStatus.value.error}"`);
    } finally {
      n.setFetchEntries(null);
      // Restore idle state
      n.nostrStatus.value = { state: 'idle', lastSync: null, error: null };
      cleanNostrConfig();
    }
  });

  await test('E-11: pushPending retries all queued UUIDs; clears list on success', async () => {
    cleanNostrConfig();
    seedNostrConfig();
    const e1 = makeTxEntry({ id: 'pending-a' });
    const e2 = makeTxEntry({ id: 'pending-b' });
    saveTxEntry(e1); saveTxEntry(e2);
    localStorage.setItem('tj_nostr_pending', JSON.stringify(['pending-a', 'pending-b']));
    let publishCalls = 0;
    n.setPublishEvent(async () => { publishCalls++; return [{ url: 'wss://stub.invalid', ok: true }]; });
    try {
      await n.pushPending();
      assert(publishCalls === 2, `Expected 2 publish calls, got ${publishCalls}`);
      const pending = JSON.parse(localStorage.getItem('tj_nostr_pending') || '[]');
      assert(pending.length === 0, `Pending list should be empty, got: ${JSON.stringify(pending)}`);
    } finally {
      n.setPublishEvent(null);
      cleanNostrConfig();
      cleanTxEntries();
    }
  });

  await test('E-12: storage hook auto-calls pushEntry when privkey and relays are configured', async () => {
    cleanNostrConfig();
    seedNostrConfig();
    let pushCalled = false;
    n.setPublishEvent(async () => { pushCalled = true; return [{ url: 'wss://stub.invalid', ok: true }]; });
    const entry = makeTxEntry({ id: 'hook-test-id' });
    try {
      // Use the real saveTx so the onSave hook fires
      n.saveTx(entry);
      // Hook fires synchronously then dispatches async work — give it a tick
      await new Promise(r => setTimeout(r, 50));
      assert(pushCalled, 'Storage onSave hook should have triggered pushEntry → publishEvent');
    } finally {
      n.setPublishEvent(null);
      try { n.removeTx(entry.id); } catch {}
      cleanNostrConfig();
    }
  });

  // ── Results ───────────────────────────────────────────────────────────────

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.group(
    `%cNostr Sync Tests — ${passed}/${results.length} passed`,
    failed ? 'color:red;font-weight:bold' : 'color:green;font-weight:bold'
  );
  console.table(results);
  console.groupEnd();
  return results;
})();
