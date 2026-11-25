// Run against qa:app on localhost. No production calls or database writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createLoader } = require('./test-support.cjs');
const { blindFixture } = require('./test-blinded-support.cjs');
const out = path.join(os.tmpdir(), 'labweb-network-loading-qa');
fs.mkdirSync(out, { recursive: true });
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../.next/react-loadable-manifest.json'), 'utf8'));
function chunk(key) {
  const entry = manifest[key];
  assert.ok(entry, key);
  return entry.files.find(f => path.basename(f).startsWith(entry.id + '.')) || entry.files.at(-1);
}
const flowChunk = chunk('app/page.tsx -> ./protocol/v5/Flow');
const readingChunk = chunk('app/protocol/v5/Flow.tsx -> ./components/ExperimentPage');
function readingSession(uid) {
  const load = createLoader(), initial = blindFixture('fertility', 24, uid);
  const delta = Date.now() - initial.startTime;
  function shift(v) {
    if (typeof v === 'number') return v > 1e12 ? v + delta : v;
    if (Array.isArray(v)) return v.map(shift);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shift(x)]));
    return v;
  }
  const f = shift(initial);
  const session = load('app/protocol/v5/lib/experimentSession.ts').createSession({ uid, conditionN: 24, topic: 'fertility', returnUrl: null });
  const all = Object.values(load('app/lib/materialsRegistry.ts').getMaterialsForTopic('fertility').materials).flat();
  Object.assign(session, { phase: 'experiment', pretest: f.pretest, comprehension: f.comprehension, rules: f.rules, microphonePermission: f.microphonePermission, reading: {
    posts: f.presentedPosts.map(p => ({ ...all.find(x => x.id === p.postId), ...p, id: p.postId })),
    startTime: f.startTime, deadline: f.endTime, savedAt: f.startTime, metrics: f.readingMetrics,
    actions: f.actions, scrollEvents: [], postVisibilitySummary: f.postVisibilitySummary, maxScrollY: 0, scrollY: 0,
    userPostDraft: '', ownPost: null, insertBeforePostId: null,
  } });
  return session;
}
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  let p;
  try {
    // Pending imports must show readable markup and a retry after a real 12s wait.
    const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    p = await c.newPage(); p.setDefaultTimeout(25000);
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await p.route('**/_next/' + flowChunk, async route => { await gate; await route.continue(); });
    const url = 'http://127.0.0.1:3210/?uid=test_network_slow_' + Date.now() + '&n=24&topic=fertility';
    let navigations = 0;
    p.on('request', request => {
      if (request.isNavigationRequest() && request.frame() === p.mainFrame()) navigations++;
    });
    await p.goto(url, { waitUntil: 'domcontentloaded' });
    await p.getByRole('heading', { name: '页面加载中…', exact: true }).waitFor();
    assert.equal(await p.getByRole('link', { name: '重新加载页面', exact: true }).isVisible(), false);
    await p.getByRole('link', { name: '重新加载页面', exact: true }).waitFor({ state: 'visible', timeout: 16000 });
    assert.equal(navigations, 1, 'loading must not auto-reload');
    assert.equal(p.url(), url);
    await p.screenshot({ path: path.join(out, 'slow-desktop.png') });
    release();
    await p.getByRole('heading', { name: '进入实验', exact: true }).waitFor();
    await c.close();
    console.log('PASS delayed import: visible loading, 12s retry, no automatic reload, recovery');

    // A failed reading import can be retried without clearing or re-timing progress.
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    p = await mobile.newPage(); p.setDefaultTimeout(25000);
    const uid = 'test_network_saved_' + Date.now(), key = 'labweb:session:v5:' + uid, session = readingSession(uid);
    await p.addInitScript(({ key, session }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(session)); }, { key, session });
    let fail = true;
    await p.route('**/_next/' + readingChunk, route => fail ? route.abort('failed') : route.continue());
    const savedUrl = 'http://127.0.0.1:3210/?uid=' + uid + '&n=24&topic=fertility';
    await p.goto(savedUrl, { waitUntil: 'domcontentloaded' });
    await p.getByRole('heading', { name: '页面暂时未能加载', exact: true }).waitFor();
    await p.getByRole('link', { name: '重新加载页面', exact: true }).waitFor({ state: 'visible' });
    const before = await p.evaluate(k => JSON.parse(localStorage.getItem(k)), key);
    assert.equal(before.reading.deadline, session.reading.deadline);
    assert.equal(before.phase, 'experiment');
    await p.screenshot({ path: path.join(out, 'failed-mobile.png') });
    fail = false;
    await p.getByRole('link', { name: '重新加载页面', exact: true }).click();
    await p.locator('.feed-card').nth(23).waitFor();
    const restored = await p.evaluate(k => JSON.parse(localStorage.getItem(k)), key);
    assert.equal(p.url(), savedUrl);
    assert.equal(restored.uid, session.uid);
    assert.equal(restored.sessionId, session.sessionId);
    assert.equal(restored.reading.startTime, session.reading.startTime);
    assert.equal(restored.reading.deadline, session.reading.deadline);
    assert.deepEqual(restored.reading.posts.map(x => x.id), session.reading.posts.map(x => x.id));
    assert.deepEqual(restored.reading.actions, session.reading.actions);
    await mobile.close();
    console.log('PASS failed chunk: error and manual reload preserve URL, UID, session, posts, actions and deadline');

    // The fallback and native reload link remain available without client JavaScript.
    const nojs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 640 } });
    p = await nojs.newPage();
    await p.goto('http://127.0.0.1:3210/?uid=test_network_nojs_' + Date.now() + '&n=24&topic=ai', { waitUntil: 'domcontentloaded' });
    await p.getByRole('heading', { name: '页面加载中…', exact: true }).waitFor();
    await p.getByText('请开启浏览器的 JavaScript 后再试。', { exact: true }).waitFor();
    await p.getByRole('link', { name: '重新加载页面', exact: true }).waitFor({ state: 'visible', timeout: 16000 });
    const nojsUrl = p.url();
    await p.screenshot({ path: path.join(out, 'nojs-320.png') });
    await p.getByRole('link', { name: '重新加载页面', exact: true }).click();
    assert.equal(p.url(), nojsUrl);
    await nojs.close();
    console.log('PASS no JavaScript: server fallback, delayed CSS retry and native reload retain URL');
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ passed: true, cases: 3, flowChunk, readingChunk, savedUid: uid }, null, 2));
  } catch (e) {
    if (p) await p.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
    throw e;
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
