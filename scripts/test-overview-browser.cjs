// Local isolated QA: response-loss retry, small screens, replay and draft recovery.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const out = path.join(require('node:os').tmpdir(), 'labweb-overview-20261126');
fs.mkdirSync(out, { recursive: true });
(async () => {
 const browser = await chromium.launch({ channel: 'chrome', headless: true });
 try {
  for (const [width, height] of [[1280,720],[375,667],[1024,768]]) {
   const context = await browser.newContext({viewport:{width,height},isMobile:width<500||width===1024,hasTouch:width<500||width===1024});
   const page = await context.newPage(); page.setDefaultTimeout(15000);
   const uid = `test_overview_${width}_${Date.now()}`, key = 'labweb:session:v5:'+uid;
   const read = () => page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
   await page.goto(`http://127.0.0.1:3210/?uid=${uid}&n=48&topic=fertility`);
   await page.getByRole('button',{name:'进入实验',exact:true}).click();
   for(let i=0;i<4;i++){await page.getByRole('radio').nth(2).check();await page.getByRole('button',{name:'下一步',exact:true}).click();}
   let fail = true;
   await page.route('**/api/progress', route=>fail ? route.fulfill({status:503,json:{error:'QA unavailable'}}) : route.continue());
   await page.getByRole('radio').nth(2).check();await page.getByRole('button',{name:'下一步',exact:true}).click();
   await page.getByRole('heading',{name:'接下来的实验流程',exact:true}).waitFor();
   await page.getByRole('button',{name:'重试保存',exact:true}).waitFor();
   assert.ok(await page.getByRole('button',{name:'开始操作教程',exact:true}).isDisabled());
   const draft=await read();assert.equal(draft.pretest.answers.length,5);assert.ok(draft.rules.overviewEnteredAt);assert.equal(draft.rules.overviewCompletedAt,null);
   fail=false;await page.getByRole('button',{name:'重试保存',exact:true}).click();
   await page.getByRole('button',{name:'开始操作教程',exact:true}).click();
   for(let i=0;i<3;i++) {
    await page.getByText(`操作教程 · ${i+1} / 3`,{exact:true}).waitFor();
    if(i<2) {
     await page.waitForFunction(()=>document.querySelector('.tutorial-demo')?.dataset.manual==='true');
     assert.ok(await page.getByRole('button',{name:'下一步',exact:true}).isEnabled());
     if(i===0) {
      const rules=(await read()).rules;await page.getByRole('button',{name:'重播演示',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('.tutorial-demo')?.getAttribute('aria-busy')==='true');
      assert.ok(await page.getByRole('button',{name:'下一步',exact:true}).isDisabled());
      await page.waitForFunction(()=>document.querySelector('.tutorial-demo')?.dataset.manual==='true');
      assert.deepEqual((await read()).rules,rules);
      await page.reload();await page.waitForFunction(()=>document.querySelector('.tutorial-demo')?.dataset.manual==='true');
      assert.deepEqual((await read()).rules,rules);
     }
    }
    const footer=await page.getByRole('button',{name:'下一步',exact:true}).boundingBox();assert.ok(footer.y>=0&&footer.y+footer.height<=height);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:path.join(out,`${width}-tutorial-${i+1}.png`)});
    await page.getByRole('button',{name:'下一步',exact:true}).click();
   }
   assert.ok((await read()).rules.overviewCompletedAt>=draft.rules.overviewEnteredAt);
   // Correct and incorrect comprehension paths both retain the minimal Ready page.
   await page.getByRole('button',{name:width<500?/^B\./:/^A\./}).click();
   await page.getByText('教程已结束',{exact:true}).waitFor();
   assert.equal((await read()).reading,null);
   await page.screenshot({path:path.join(out,`${width}-ready.png`)});
   await page.getByRole('button',{name:'开始实验',exact:true}).click();
   await page.locator('main.reading-feed .feed-card').nth(47).waitFor();
   const state=await read();assert.equal(state.reading.deadline-state.reading.startTime,150000);
   console.log(`PASS ${width}x${height}: retry, no hands-on gate, replay, reload, ready timer boundary`);
   await context.close();
  }
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
