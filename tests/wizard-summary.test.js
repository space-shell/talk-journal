/**
 * Behavioural tests for Epics 13–15 — Wizard flow, ATF entries, Session summary
 * US-35: One recording shown at a time with progress indicator
 * US-36: Previous / Next / Finish navigation
 * US-37: Next disabled while transcribing
 * US-38: ATF entry input per recording card
 * US-39: Multiple entries per type
 * US-40: Character limit 160
 * US-41: Delete individual entries
 * US-42: Summary page accessible via Finish
 * US-43: Summary shows counts per ATF type
 * US-44: Summary lists all entries grouped by type
 * US-45: Start new session returns to home
 *
 * Run via Chrome DevTools evaluate_script on the live app page.
 * Requires window._tj test hooks (files, busy, appView, wizardIndex signals).
 */

(async function runWizardTests() {
  const results = [];

  function assert(condition, msg) {
    if (!condition) throw new Error(msg || 'Assertion failed');
  }
  async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function resetState() {
    if (!window._tj) return;
    window._tj.files.value = [];
    window._tj.busy.value = false;
    window._tj.appView.value = 'home';
    window._tj.wizardIndex.value = 0;
  }

  async function test(name, fn) {
    resetState();
    await sleep(40);
    try {
      await fn();
      results.push({ status: 'PASS', name, error: '' });
    } catch (e) {
      results.push({ status: 'FAIL', name, error: e.message });
    } finally {
      resetState();
      await sleep(40);
    }
  }

  function makeFile(overrides = {}) {
    return {
      name: 'REC_001.wav', path: 'test/REC_001.wav', size: 5 * 1024 * 1024,
      mtime: Date.now() - 3600000, selected: true, status: 'done',
      transcript: 'Hello world.', savedId: null, deleted: false,
      notes: '', entries: [], error: null, handle: null,
      ...overrides,
    };
  }

  function injectWizard(files) {
    assert(window._tj, 'window._tj test hooks not found');
    window._tj.files.value = files;
    window._tj.wizardIndex.value = 0;
    window._tj.appView.value = 'wizard';
  }

  function findBtn(label) {
    return [...document.querySelectorAll('button')].find(
      b => b.textContent.trim() === label
    );
  }

  // ── US-35: One recording shown at a time ──────────────────────────────────

  await test('US-35: wizard progress bar is visible in wizard view', async () => {
    injectWizard([makeFile(), makeFile({ name: 'REC_002.wav', path: 'test/REC_002.wav' })]);
    await sleep(60);
    const bar = document.querySelector('.wizard-progress-wrap');
    assert(bar, '.wizard-progress-wrap not found in wizard view');
  });

  await test('US-35: wizard shows "Recording X of N" indicator', async () => {
    injectWizard([makeFile(), makeFile({ name: 'REC_002.wav', path: 'test/REC_002.wav' })]);
    await sleep(60);
    const meta = document.querySelector('.wizard-meta');
    assert(meta, '.wizard-meta not found');
    assert(meta.textContent.includes('1') && meta.textContent.includes('2'),
      `Expected "1 of 2" indicator, got: ${meta?.textContent}`);
  });

  await test('US-35: progress bar fill is 50% for first of two recordings', async () => {
    injectWizard([makeFile(), makeFile({ name: 'REC_002.wav', path: 'test/REC_002.wav' })]);
    await sleep(60);
    const fill = document.querySelector('.wizard-progress-fill');
    assert(fill, '.wizard-progress-fill not found');
    assert(fill.style.width === '50%', `Expected 50%, got: ${fill.style.width}`);
  });

  await test('US-35: progress bar fill is 100% for last of two recordings', async () => {
    injectWizard([makeFile(), makeFile({ name: 'REC_002.wav', path: 'test/REC_002.wav' })]);
    window._tj.wizardIndex.value = 1;
    await sleep(60);
    const fill = document.querySelector('.wizard-progress-fill');
    assert(fill, '.wizard-progress-fill not found');
    assert(fill.style.width === '100%', `Expected 100%, got: ${fill.style.width}`);
  });

  // ── US-36: Previous / Next / Finish navigation ────────────────────────────

  await test('US-36: Next button is present on first card', async () => {
    injectWizard([makeFile(), makeFile({ name: 'REC_002.wav', path: 'test/REC_002.wav' })]);
    await sleep(60);
    const next = findBtn('Next →');
    assert(next, 'Next → button not found on first card');
  });

  await test('US-36: Back button is absent on first card', async () => {
    injectWizard([makeFile(), makeFile({ name: 'REC_002.wav', path: 'test/REC_002.wav' })]);
    await sleep(60);
    const back = findBtn('← Back');
    assert(!back, '← Back button should not appear on first card');
  });

  await test('US-36: Next advances wizard index', async () => {
    injectWizard([makeFile(), makeFile({ name: 'REC_002.wav', path: 'test/REC_002.wav' })]);
    await sleep(60);
    findBtn('Next →').click();
    await sleep(60);
    assert(window._tj.wizardIndex.value === 1, `Expected wizardIndex 1, got ${window._tj.wizardIndex.value}`);
  });

  await test('US-36: Back button appears after advancing to card 2', async () => {
    injectWizard([makeFile(), makeFile({ name: 'REC_002.wav', path: 'test/REC_002.wav' })]);
    await sleep(60);
    findBtn('Next →').click();
    await sleep(60);
    const back = findBtn('← Back');
    assert(back, '← Back button not found on card 2');
  });

  await test('US-36: Back decrements wizard index', async () => {
    injectWizard([makeFile(), makeFile({ name: 'REC_002.wav', path: 'test/REC_002.wav' })]);
    window._tj.wizardIndex.value = 1;
    await sleep(60);
    findBtn('← Back').click();
    await sleep(60);
    assert(window._tj.wizardIndex.value === 0, `Expected wizardIndex 0, got ${window._tj.wizardIndex.value}`);
  });

  await test('US-36: last card shows Finish → instead of Next →', async () => {
    injectWizard([makeFile(), makeFile({ name: 'REC_002.wav', path: 'test/REC_002.wav' })]);
    window._tj.wizardIndex.value = 1;
    await sleep(60);
    assert(findBtn('Finish →'), 'Finish → button not found on last card');
    assert(!findBtn('Next →'), 'Next → should not appear on last card');
  });

  await test('US-36: Finish → switches appView to summary', async () => {
    injectWizard([makeFile()]);
    await sleep(60);
    findBtn('Finish →').click();
    await sleep(60);
    assert(window._tj.appView.value === 'summary', `Expected appView=summary, got ${window._tj.appView.value}`);
  });

  // ── US-37: Next disabled while transcribing ───────────────────────────────

  await test('US-37: Next is disabled when file status is transcribing', async () => {
    injectWizard([makeFile({ status: 'transcribing', transcript: null })]);
    await sleep(60);
    const nav = document.querySelector('.wizard-nav');
    const nextBtn = nav && [...nav.querySelectorAll('button')].find(b => b.disabled);
    assert(nextBtn, 'No disabled button found in wizard-nav when status=transcribing');
  });

  await test('US-37: Next is disabled when file status is converting', async () => {
    injectWizard([makeFile({ status: 'converting', transcript: null })]);
    await sleep(60);
    const nav = document.querySelector('.wizard-nav');
    const nextBtn = nav && [...nav.querySelectorAll('button')].find(b => b.disabled);
    assert(nextBtn, 'No disabled button found in wizard-nav when status=converting');
  });

  await test('US-37: Next is enabled when file status is done', async () => {
    injectWizard([makeFile({ status: 'done' })]);
    await sleep(60);
    const nav = document.querySelector('.wizard-nav');
    const btns = nav ? [...nav.querySelectorAll('button')] : [];
    assert(btns.length > 0, 'No buttons in wizard-nav');
    const allEnabled = btns.every(b => !b.disabled);
    assert(allEnabled, 'Nav button should be enabled when status=done');
  });

  // ── US-38/39: ATF entry inputs ────────────────────────────────────────────

  await test('US-38: ATF section is visible when card has transcript', async () => {
    injectWizard([makeFile({ transcript: 'Some transcript', status: 'done' })]);
    await sleep(60);
    const atf = document.querySelector('.atf-section');
    assert(atf, '.atf-section not found when card has transcript');
  });

  await test('US-38: ATF section has labels for Actions, Thoughts, Feelings', async () => {
    injectWizard([makeFile({ transcript: 'Some transcript', status: 'done' })]);
    await sleep(60);
    const labels = [...document.querySelectorAll('.atf-label')].map(el => el.textContent.trim());
    assert(labels.includes('Actions'),  'Actions ATF group not found');
    assert(labels.includes('Thoughts'), 'Thoughts ATF group not found');
    assert(labels.includes('Feelings'), 'Feelings ATF group not found');
  });

  await test('US-39: Add button is present for each ATF type', async () => {
    injectWizard([makeFile({ transcript: 'Some transcript', status: 'done' })]);
    await sleep(60);
    const addBtns = [...document.querySelectorAll('.atf-section button')].filter(
      b => b.textContent.trim() === 'Add'
    );
    assert(addBtns.length >= 3, `Expected at least 3 Add buttons, found ${addBtns.length}`);
  });

  // ── US-40: Character limit 160 ────────────────────────────────────────────

  await test('US-40: ATF input has maxlength of 160', async () => {
    injectWizard([makeFile({ transcript: 'Some transcript', status: 'done' })]);
    await sleep(60);
    const input = document.querySelector('.atf-input');
    assert(input, '.atf-input not found');
    assert(input.maxLength === 160, `Expected maxlength 160, got ${input.maxLength}`);
  });

  // ── US-42/44: Summary page ────────────────────────────────────────────────

  await test('US-42: summary stats grid renders when appView=summary', async () => {
    window._tj.files.value = [makeFile({
      entries: [{ id: '1', type: 'action', text: 'Do something', createdAt: new Date().toISOString() }]
    })];
    window._tj.appView.value = 'summary';
    await sleep(60);
    const stats = document.querySelector('.summary-stats');
    assert(stats, '.summary-stats not found when appView=summary');
  });

  await test('US-43: summary shows stat counts', async () => {
    window._tj.files.value = [makeFile({
      entries: [
        { id: '1', type: 'action',  text: 'Do A', createdAt: new Date().toISOString() },
        { id: '2', type: 'thought', text: 'Think B', createdAt: new Date().toISOString() },
        { id: '3', type: 'feeling', text: 'Feel C', createdAt: new Date().toISOString() },
      ]
    })];
    window._tj.appView.value = 'summary';
    await sleep(60);
    const stats = document.querySelector('.summary-stats');
    assert(stats, '.summary-stats not found');
    assert(stats.textContent.includes('1'), 'Stats should show count of 1 for each type');
  });

  await test('US-44: summary lists entry text grouped by type', async () => {
    window._tj.files.value = [makeFile({
      entries: [
        { id: '1', type: 'action', text: 'Walk the dog', createdAt: new Date().toISOString() },
        { id: '2', type: 'feeling', text: 'Feeling good', createdAt: new Date().toISOString() },
      ]
    })];
    window._tj.appView.value = 'summary';
    await sleep(60);
    const body = document.body.textContent;
    assert(body.includes('Walk the dog'), 'Action entry text not found in summary');
    assert(body.includes('Feeling good'), 'Feeling entry text not found in summary');
  });

  await test('US-45: Start new session returns appView to home', async () => {
    window._tj.files.value = [makeFile()];
    window._tj.appView.value = 'summary';
    await sleep(60);
    const newBtn = [...document.querySelectorAll('button')].find(
      b => b.textContent.toLowerCase().includes('new session') || b.textContent.toLowerCase().includes('start new')
    );
    assert(newBtn, 'New session button not found on summary page');
    newBtn.click();
    await sleep(60);
    assert(window._tj.appView.value === 'home', `Expected appView=home, got ${window._tj.appView.value}`);
  });

  // ── Results ───────────────────────────────────────────────────────────────

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.group(`%cEpics 13–15 Behavioural Tests — ${passed}/${results.length} passed`, failed ? 'color:red' : 'color:green');
  console.table(results);
  console.groupEnd();
  return results;
})();
