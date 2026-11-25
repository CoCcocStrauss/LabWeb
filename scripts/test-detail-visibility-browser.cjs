// Start qa-server.cjs and qa-app.cjs first. Uses only localhost and test_ UIDs.
// Clock offsets and visibility overrides are confined to these browser contexts.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'), assert = require('node:assert/strict'), fs = require('node:fs');
const out = require('node:path').join(require('node:os').tmpdir(), 'labweb-detail-visibility-qa');
fs.mkdirSync(out, { recursive: true });
(async () => {
    const b = await chromium.launch({ channel: 'chrome', headless: true });
    let p;
    try {
        for (const [width, height, mode, n] of [[1440, 900, 'manual', 24], [390, 844, 'timeout', 48]]) {
            const c = await b.newContext({ viewport: { width, height }, isMobile: width < 500, hasTouch: width < 500 });
            p = await c.newPage();
            p.setDefaultTimeout(30000);
            const errors = [];
            p.on('pageerror', e => { errors.push(e.message); console.error('BROWSER ERROR: ' + e.message); });
            await p.addInitScript(() => { const real = Date.now; Date.now = () => real() + Number(sessionStorage.getItem('qa_clock_offset') ?? 0); Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: () => Promise.reject(new DOMException('QA', 'NotAllowedError')) }); });
            const uid = 'test_detail_browser_' + width + '_' + Date.now(), key = 'labweb:session:v5:' + uid;
            const read = () => p.evaluate(k => JSON.parse(localStorage.getItem(k)), key), total = (s, id) => s.reading.metrics.detailIntervals.filter(i => i.postId === id).reduce((sum, i) => sum + i.durationMs, 0);
            const setVisibility = state => p.evaluate(state => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state }); const at = Date.now(); document.dispatchEvent(new Event('visibilitychange')); return at; }, state);
            const jump = elapsed => p.evaluate(({ key, elapsed }) => { const start = JSON.parse(localStorage.getItem(key)).reading.startTime, real = Date.now() - Number(sessionStorage.getItem('qa_clock_offset') ?? 0); sessionStorage.setItem('qa_clock_offset', String(start + elapsed - real)); }, { key, elapsed });
            await p.goto('http://127.0.0.1:3210/?uid=' + uid + '&n='+n+'&topic=fertility');
            await p.getByRole('button', { name: '进入实验', exact: true }).click();
            for (let i = 0; i < 5; i++) {
                await p.getByRole('radio').nth(2).check();
                await p.getByRole('button', { name: '下一步', exact: true }).click();
            }
            await p.getByRole('heading',{name:'如何阅读',exact:true}).waitFor();
            assert.equal(await p.getByRole('checkbox').count(),0);
            await p.locator('.tutorial-demo .feed-card.is-expanded').waitFor();
            await p.getByRole('button',{name:'收起',exact:true}).click();
            assert.equal(await p.locator('.tutorial-demo').getAttribute('data-manual'),'true');
            await p.waitForTimeout(2700);assert.equal(await p.locator('.tutorial-demo .feed-card.is-expanded').count(),0);
            await p.screenshot({path:out+'/tutorial-step1-'+width+'.png'});
            await p.getByRole('button',{name:'下一步',exact:true}).click();
            await p.getByRole('heading',{name:'如何转发与改选',exact:true}).waitFor();
            await p.getByRole('button',{name:'已转发',exact:true}).click();
            await p.waitForTimeout(2700);assert.equal(await p.getByRole('button',{name:'已转发',exact:true}).count(),0);
            await p.screenshot({path:out+'/tutorial-step2-'+width+'.png'});
            const labels=(await read()).rules.demoLabelSelections;
            await p.getByRole('button',{name:'下一步',exact:true}).click();
            await p.getByRole('heading',{name:'时间、专注与激励',exact:true}).waitFor();
            assert.ok(!(await p.locator('body').innerText()).includes('100'));
            await p.getByRole('button',{name:'上一步',exact:true}).click();
            await p.getByRole('button',{name:'下一步',exact:true}).click();
            await p.reload();await p.getByRole('heading',{name:'时间、专注与激励',exact:true}).waitFor();
            assert.deepEqual((await read()).rules.demoLabelSelections,labels);
            assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
            await p.screenshot({path:out+'/tutorial-step3-'+width+'.png'});
            await p.getByRole('button',{name:'下一步',exact:true}).click();
            const rules=(await read()).rules;assert.equal(rules.items.length,3);assert.ok(rules.items.every(i=>i.checked&&i.enteredAt&&i.completedAt));
            await p.getByRole('button', { name: /^A\./ }).click();
            await p.getByRole('button', { name: '开始实验', exact: true }).click();
            console.log('Started ' + width + 'px');
            await p.locator('.feed-card').nth(n-1).waitFor();
            await p.waitForTimeout(700);
            const first = p.locator('.feed-card').first(), id = await first.getAttribute('data-post-id');
            await first.locator('.feed-content-button').click();
            await p.waitForFunction(({ key, id }) => JSON.parse(localStorage.getItem(key)).reading.metrics.detailIntervals.some(i => i.postId === id && i.durationMs > 200), { key, id });
            let s = await read();
            const opened = s.reading.metrics.detailEvents.find(e => e.postId === id && e.type === 'open'), left = s.reading.scrollEvents.find(e => e.postId === id && e.action === 'leave_viewport');
            assert.equal(left.timestamp, opened.timestamp);
            const previewAtOpen = s.reading.postVisibilitySummary[id].totalVisibleMs;
            if (width > 500) {
                await p.locator('.feed-card').nth(1).locator('.feed-content-button').click();
                await p.waitForTimeout(1200);
                assert.equal((await read()).reading.metrics.openDetailIds.length, 2);
            }
            await p.locator('main.reading-feed').evaluate(el => { el.scrollTop = el.scrollHeight; });
            await p.waitForTimeout(1200);
            const off = await read(), offTotal = total(off, id);
            await p.waitForTimeout(1200);
            assert.equal(total(await read(), id), offTotal);
            assert.equal((await read()).reading.postVisibilitySummary[id].totalVisibleMs, previewAtOpen);
            await p.locator('main.reading-feed').evaluate(el => { el.scrollTop = 0; });
            await p.waitForTimeout(1300);
            s = await read();
            assert.ok(total(s, id) > offTotal);
            assert.ok(s.reading.metrics.detailIntervals.filter(i => i.postId === id).length >= 2);
            const hiddenAt = await setVisibility('hidden'), hidden = await read();
            await p.waitForTimeout(3100);
            assert.equal(total(await read(), id), total(hidden, id));
            const visibleAt = await setVisibility('visible');
            await p.locator('.reading-return-notice').waitFor();
            assert.equal((await read()).reading.deadline,hidden.reading.deadline);
            await p.waitForTimeout(1200);assert.equal(await p.locator('.reading-return-notice').count(),1);
            await p.waitForTimeout(2000);assert.equal(await p.locator('.reading-return-notice').count(),0);
            assert.ok((await read()).reading.metrics.totalHiddenMs>=3000);
            s = await read();
            assert.ok(total(s, id) > total(hidden, id));
            assert.ok(s.reading.metrics.detailIntervals.some(i => i.postId === id && i.startMs >= visibleAt));
            assert.ok(s.reading.metrics.detailIntervals.every(i => i.endMs <= hiddenAt + 20 || i.startMs >= visibleAt));
            // A real reload with a delayed navigation verifies the navigation gap is excluded.
            await p.route('**/*', async (route) => { if (route.request().isNavigationRequest())
                await new Promise(r => setTimeout(r, 1200)); await route.continue(); });
            const beforeReload = await read();
            await p.reload();
            await p.unroute('**/*');
            await p.locator('.feed-card.is-expanded').first().waitFor();
            await p.waitForTimeout(1200);
            s = await read();
            assert.ok(s.reading.metrics.detailIntervals.some(i => i.postId === id && i.startMs >= beforeReload.reading.savedAt + 1000));
            await first.getByRole('button', { name: '收起', exact: true }).click();
            await p.waitForTimeout(1200);
            s = await read();
            const close = s.reading.metrics.detailEvents.filter(e => e.postId === id && e.type === 'close').at(-1);
            assert.ok(s.reading.metrics.detailIntervals.filter(i => i.postId === id).every(i => i.endMs <= close.timestamp));
            const afterClose = total(s, id);
            await p.waitForTimeout(1100);
            assert.equal(total(await read(), id), afterClose);
            assert.ok((await read()).reading.postVisibilitySummary[id].totalVisibleMs > previewAtOpen);
            await first.locator('.feed-content-button').click();
            for (let i = 0; i < 3; i++) {
                await p.locator('.feed-card').nth(i).getByRole('button', { name: '转发', exact: true }).click();
                await p.getByRole('button', { name: '确认', exact: true }).click();
            }
            await first.getByRole('button',{name:'已转发',exact:true}).click();
            await first.locator('.feed-fulltext').scrollIntoViewIfNeeded();
            await p.waitForTimeout(400);
            await p.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
            await jump(mode === 'manual' ? 100100 : 149300);
            await p.evaluate(()=>window.dispatchEvent(new Event('pageshow')));
            if (mode === 'manual') {
                await p.getByRole('button', { name: '完成浏览', exact: true }).waitFor();
                await p.waitForTimeout(400);
                await p.getByRole('button', { name: '完成浏览', exact: true }).click();
            }
            await p.getByRole('radio').nth(2).waitFor();
            s = await read();
            assert.equal(s.phase, 'posttest');
            assert.equal(s.endData.endReason, mode);
            if (mode === 'timeout')
                assert.equal(s.endData.endTime - s.endData.startTime, 150000);
            assert.ok(s.endData.actions.some(a=>a.type==='unshare'&&a.postId===id));
            const intervals = s.endData.readingMetrics.detailIntervals;
            assert.ok(intervals.length >= 4);
            assert.ok(intervals.some(i => i.postId === id && i.endMs >= s.endData.endTime - 20));
            for (const i of intervals) {
                assert.equal(i.startMs, i.startedAt);
                assert.equal(i.endMs, i.endedAt);
                assert.equal(i.durationMs, i.endMs - i.startMs);
                assert.ok(i.durationMs > 0);
                assert.ok(i.endMs <= s.endData.endTime);
                const prev = s.endData.scrollEvents.filter(e => e.postId === i.postId);
                let enter = null;
                for (const e of prev) {
                    if (e.action === 'enter_viewport')
                        enter = e.timestamp;
                    else if (enter !== null) {
                        assert.ok(!(i.startMs < e.timestamp && i.endMs > enter), 'detail and preview overlap');
                        enter = null;
                    }
                }
            }
            for (let i = 0; i < 2; i++) {
                await p.getByRole('radio').nth(2).check();
                await p.getByRole('button', { name: '下一步', exact: true }).click();
            }
            const sampled=await read();assert.notEqual(sampled.recognition.targetPostId,id);
            await p.getByText('记不清了', { exact: true }).click();
            await p.getByRole('button', { name: '下一步', exact: true }).click();
            assert.ok(!(await read()).blindedPostEvaluations.items.some(i=>i.postId===id&&i.sampleRole==='shared'));
            for (let i = 0; i < 4; i++) {
                await p.getByRole('heading', { name: '内容评价（' + (i + 1) + ' / 4）', exact: true }).waitFor();
                await p.locator('input[name="endorsementScore"]').nth(2).check();
                await p.locator('input[name="argumentQualityScore"]').nth(3).check();
                await p.getByRole('button', { name: i === 3 ? '继续' : '下一条', exact: true }).click();
            }
            await p.locator('#explanation-text').fill('本次为展开可见阅读时长的隔离验收，检查滚动、切屏、刷新和实验结束后的完整保存。');
            await p.getByRole('button', { name: '提交', exact: true }).click();
            await p.getByRole('radio').nth(1).check();
            await p.getByRole('button', { name: '提交', exact: true }).click();
            await p.getByRole('heading', { name: '本部分已完成', exact: true }).waitFor();
            const saved = await (await fetch('http://127.0.0.1:3211/_qa/state?uid=' + uid)).json();
            assert.ok(saved.session.completed_at);
            assert.deepEqual(saved.session.reading_metrics.detailIntervals, intervals);
            assert.deepEqual(errors, []);
            fs.writeFileSync(out + '/result-' + width + '.json', JSON.stringify({ uid, mode, passed: true, postId: id, previewVisibleMs: s.endData.postVisibilitySummary[id].totalVisibleMs, detailIntervals: intervals, endTime: s.endData.endTime, counts: saved.counts, rules:saved.session.rules, hiddenCount:saved.session.reading_metrics.hiddenCount,totalHiddenMs:saved.session.reading_metrics.totalHiddenMs, visibilityTest: 'simulated document visibilitychange; actual scroll and reload' }, null, 2));
            await p.screenshot({ path: out + '/complete-' + width + '.png' });
            console.log('PASS ' + width + 'px: visible expansion, scroll out/in, simulated visibility, real reload gap, collapse, ' + mode + ' end, final database round-trip, no overlap/page errors');
            await c.close();
        }
    }
    catch (e) {
        if (p) {
            console.error('Failure state: ' + JSON.stringify(await p.evaluate(() => ({ visibility: document.visibilityState, states: Object.keys(localStorage).filter(k => k.startsWith('labweb:session:v5:test_detail_browser')).map(k => { const s = JSON.parse(localStorage.getItem(k)); return { phase: s.phase, attempt: s.comprehension, reading: s.reading ? { detailEvents: s.reading.metrics.detailEvents, detailIntervals: s.reading.metrics.detailIntervals } : null }; }) })).catch(() => null)));
            await p.screenshot({ path: out + '/failure.png' }).catch(() => { });
            fs.writeFileSync(out + '/failure.txt', await p.locator('body').innerText().catch(() => ''));
        }
        throw e;
    }
    finally {
        await b.close();
    }
})().catch(e => { console.error(e); process.exitCode = 1; });
