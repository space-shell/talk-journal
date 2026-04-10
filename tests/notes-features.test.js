/**
 * Behavioural tests for Epic 11 — Notes & In-Card Actions
 * US-29: Horizontal action buttons
 * US-30: Notes add / save / view toggle
 * US-31: Voice note transcription into notes
 *
 * Run via Chrome DevTools evaluate_script on the live app page,
 * or paste into the browser console.
 *
 * Requires window._tj test hooks exposed by the app.
 */

(async function runNoteTests() {
  const results = [];

  function assert(condition, msg) {
    if (!condition) throw new Error(msg || 'Assertion failed');
  }

  async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  async function test(name, fn) {
    // Always reset shared state before each test to prevent pollution
    if (window._tj) {
      window._tj.files.value = [];
      window._tj.busy.value  = false;
    }
    await sleep(40);
    try {
      await fn();
      results.push({ status: 'PASS', name, error: '' });
    } catch (e) {
      results.push({ status: 'FAIL', name, error: e.message });
    } finally {
      // Always clean up, even if the test threw
      if (window._tj) window._tj.files.value = [];
      if (window._tj) window._tj.busy.value  = false;
    }
  }

  function injectFile(overrides = {}) {
    assert(window._tj, 'window._tj test hooks not found — ensure the app exposes them');
    window._tj.files.value = [{
      name:       'TEST_recording.wav',
      path:       'test/TEST_recording.wav',
      size:       17 * 1024 * 1024,
      mtime:      Date.now() - 7200000,
      selected:   true,
      status:     'done',
      transcript: 'This is a test transcription.',
      savedId:    null,
      deleted:    false,
      notes:      '',
      error:      null,
      handle:     null,
      ...overrides,
    }];
  }

  function cleanup() {
    if (window._tj) window._tj.files.value = [];
  }

  function findBtn(label) {
    return [...document.querySelectorAll('.btn')].find(
      b => b.textContent.trim() === label
    );
  }

  // ── US-29: Horizontal action buttons ─────────────────────────────────────

  await test('US-29: .tx-actions uses flex-direction row', async () => {
    injectFile();
    await sleep(60);
    const el = document.querySelector('.tx-actions');
    assert(el, '.tx-actions element not found');
    assert(getComputedStyle(el).flexDirection === 'row',
      `Expected flex-direction:row, got ${getComputedStyle(el).flexDirection}`);
    cleanup();
  });

  await test('US-29: .tx-actions wraps on overflow (flex-wrap:wrap)', async () => {
    injectFile();
    await sleep(60);
    const el = document.querySelector('.tx-actions');
    assert(el, '.tx-actions element not found');
    assert(getComputedStyle(el).flexWrap === 'wrap',
      `Expected flex-wrap:wrap, got ${getComputedStyle(el).flexWrap}`);
    cleanup();
  });

  await test('US-29: Copy, Notes, and Delete buttons are present in action row', async () => {
    injectFile();
    await sleep(60);
    assert(findBtn('Copy'),   'Copy button not found');
    assert(findBtn('Notes'),  'Notes button not found');
    assert(findBtn('Delete'), 'Delete button not found');
    cleanup();
  });

  // ── US-30: Notes open / edit / save / view ───────────────────────────────

  await test('US-30: Notes button opens textarea when notes are empty', async () => {
    injectFile({ notes: '' });
    await sleep(60);
    findBtn('Notes').click();
    await sleep(60);
    const ta = document.querySelector('.notes-area');
    assert(ta, 'Textarea not shown after clicking Notes on empty card');
    cleanup();
  });

  await test('US-30: Notes button opens read-only view when notes already exist', async () => {
    injectFile({ notes: 'Pre-existing note text' });
    await sleep(60);
    findBtn('Notes').click();
    await sleep(60);
    const view = document.querySelector('.notes-view');
    assert(view, '.notes-view element not found for pre-existing notes');
    assert(view.textContent.includes('Pre-existing note text'),
      'Notes view does not display the saved note text');
    const ta = document.querySelector('.notes-area');
    assert(!ta, 'Textarea should not be visible when notes already exist');
    cleanup();
  });

  await test('US-30: Save button persists note and switches to read-only view', async () => {
    injectFile({ notes: '' });
    await sleep(60);
    findBtn('Notes').click();
    await sleep(60);

    const ta = document.querySelector('.notes-area');
    assert(ta, 'Textarea not found before saving');

    // Simulate typing via native value setter (works with React/Preact controlled inputs)
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, 'My test note');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(60);

    const saveBtn = findBtn('Save');
    assert(saveBtn, 'Save button not found');
    saveBtn.click();
    await sleep(60);

    const view = document.querySelector('.notes-view');
    assert(view, '.notes-view not shown after clicking Save');
    assert(!document.querySelector('.notes-area'), 'Textarea still visible after saving');
    cleanup();
  });

  await test('US-30: Edit button returns to textarea from read-only view', async () => {
    injectFile({ notes: 'A saved note' });
    await sleep(60);
    findBtn('Notes').click();
    await sleep(60);
    const editBtn = findBtn('Edit');
    assert(editBtn, 'Edit button not found in read-only view');
    editBtn.click();
    await sleep(60);
    assert(document.querySelector('.notes-area'), 'Textarea not visible after clicking Edit');
    cleanup();
  });

  await test('US-30: Closing and reopening Notes preserves saved state', async () => {
    injectFile({ notes: 'Persisted note' });
    await sleep(60);
    // Open
    findBtn('Notes').click();
    await sleep(60);
    assert(document.querySelector('.notes-view'), 'Not in view mode on first open');
    // Close
    findBtn('Notes').click();
    await sleep(60);
    assert(!document.querySelector('.notes-view'), 'Notes section still visible after close');
    // Re-open
    findBtn('Notes').click();
    await sleep(60);
    assert(document.querySelector('.notes-view'), 'Not in view mode after re-open');
    cleanup();
  });

  // ── US-31: Voice note transcription ──────────────────────────────────────

  await test('US-31: Transcribe (mic) button is visible in notes edit area', async () => {
    injectFile({ notes: '' });
    await sleep(60);
    findBtn('Notes').click();
    await sleep(60);
    const micBtn = document.querySelector('[data-mic]');
    assert(micBtn, '[data-mic] transcribe button not found in notes edit area');
    cleanup();
  });

  await test('US-31: Transcribe button is disabled when model not loaded', async () => {
    const originalModel = window._tj.parakeetModel;
    window._tj.parakeetModel = null; // simulate no model
    injectFile({ notes: '' });
    await sleep(60);
    findBtn('Notes').click();
    await sleep(60);
    const micBtn = document.querySelector('[data-mic]');
    assert(micBtn, 'Mic button not found');
    assert(micBtn.disabled, 'Mic button should be disabled when model not loaded');
    window._tj.parakeetModel = originalModel; // restore
    cleanup();
  });

  await test('US-31: Transcribe button is enabled when model is loaded', async () => {
    // Simulate a loaded model stub
    const originalModel = window._tj.parakeetModel;
    if (!originalModel) window._tj.parakeetModel = { transcribeLongAudio: async () => ({ text: '' }) };
    injectFile({ notes: '' });
    await sleep(60);
    findBtn('Notes').click();
    await sleep(60);
    const micBtn = document.querySelector('[data-mic]');
    assert(micBtn, 'Mic button not found');
    assert(!micBtn.disabled, 'Mic button should be enabled when model is loaded');
    window._tj.parakeetModel = originalModel;
    cleanup();
  });

  // ── Results ───────────────────────────────────────────────────────────────

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.group(`%cEpic 11 Behavioural Tests — ${passed}/${results.length} passed`, failed ? 'color:red' : 'color:green');
  console.table(results);
  console.groupEnd();
  return results;
})();
