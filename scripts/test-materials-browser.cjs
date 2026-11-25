// Run qa-server.cjs + qa-app.cjs first. Local memory database only.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const out = path.join(require('node:os').tmpdir(), 'labweb-materials-20261125');
fs.mkdirSync(out, { recursive: true });
(async () => {
 const browser = await chromium.launch({ channel: 'chrome', headless: true });
 let page;
 try {
  for (const [width, height, topic] of [[1280,720,'fertility'],[390,844,'ai']]) {
   const context = await browser.newContext({ viewport:{width,height},isMobile:width<500,hasTouch:width<500 });
   page = await context.newPage();page.setDefaultTimeout(15000);
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   const uid=`test_materials_${topic}_${Date.now()}`,key='labweb:session:v5:'+uid;
   await page.addInitScript(()=>{
    const real=Date.now;Date.now=()=>real()+Number(sessionStorage.getItem('qa_clock_offset')||0);
    Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:()=>Promise.reject(new DOMException('QA denied','NotAllowedError'))});
   });
   await page.goto(`http://127.0.0.1:3210/?uid=${uid}&n=24&topic=${topic}`);
   await page.getByRole('button',{name:'进入实验',exact:true}).click();
   const core=topic==='fertility'?'如果每个孩子从出生起每月领 800 元育儿补贴、直到 18 岁，你认为中国的生育率会明显提升吗？':'如果以后医院普遍用 AI 帮医生看病，你认为普通人看病被误诊、漏诊的情况会明显减少吗？';
   await page.getByText(core,{exact:true}).waitFor();
   assert.ok(!/2000|工作机会|就业/.test(await page.locator('body').innerText()));
   await page.screenshot({path:path.join(out,`${topic}-pretest.png`)});
   for(let i=0;i<5;i++){await page.getByRole('radio').nth(2).check();await page.getByRole('button',{name:'下一步',exact:true}).click();}
   for(const [i,heading] of ['如何阅读','如何转发与改选','认真阅读并清晰说明理由的参与者，将获得额外红包奖励。'].entries()){
    await page.getByRole('heading',{name:heading,exact:true}).waitFor();
    const demo=page.locator('.tutorial-demo'), cards=demo.locator('.feed-card');
    assert.equal(await cards.count(),8);
    assert.equal(await demo.locator('.dual-zone-feed').getAttribute('data-columns'),width>=1024?'4':'2');
    const footer=await page.getByRole('button',{name:'下一步',exact:true}).boundingBox();
    assert.ok(footer.y>=0&&footer.y+footer.height<=height,'tutorial next button remains on screen');
    if(i<2){
     await demo.locator(i===0?'.feed-card.is-expanded':'button[aria-pressed="true"]').first().waitFor();
     await page.screenshot({path:path.join(out,topic+'-tutorial-auto-'+(i+1)+'.png')});
     if(i===1) await demo.getByText('已转发 1 条（至少 2 条）',{exact:true}).waitFor();
     await page.waitForFunction(()=>document.querySelector('.tutorial-demo')?.dataset.manual==='true');
     assert.equal(await demo.locator('.is-expanded').count(),0);
     await demo.getByText('已转发 0 条（至少 2 条）',{exact:true}).waitFor();
     await page.waitForTimeout(1000);
     assert.equal(await demo.locator('.is-expanded').count(),0,'automatic round does not repeat');
     if(width>=768){
      const replayBox=await page.getByRole('button',{name:'重播演示',exact:true}).boundingBox();
      assert.ok(replayBox.y+replayBox.height<=footer.y,'replay control remains above the footer');
     }
     await page.screenshot({path:path.join(out,topic+'-tutorial-ready-'+(i+1)+'.png')});
     await cards.first().locator('.feed-content-button').click();
     await demo.locator('.feed-card.is-expanded').waitFor();
     await cards.nth(1).locator('.feed-content-button').click();
     assert.equal(await demo.locator('.feed-card.is-expanded').count(),2,'manual expansions remain independent');
     await cards.first().getByRole('button',{name:'收起',exact:true}).click();
     await cards.first().getByRole('button',{name:'转发',exact:true}).click();
     await demo.getByText('已转发 1 条（至少 2 条）',{exact:true}).waitFor();
     await cards.first().getByRole('button',{name:'已转发',exact:true}).click();
     await demo.getByText('已转发 0 条（至少 2 条）',{exact:true}).waitFor();
     if(i===1){
      await page.getByRole('button',{name:'重播演示',exact:true}).click();
      await demo.getByText('已转发 1 条（至少 2 条）',{exact:true}).waitFor();
      await page.waitForFunction(()=>document.querySelector('.tutorial-demo')?.dataset.manual==='true');
      await demo.getByText('已转发 0 条（至少 2 条）',{exact:true}).waitFor();
     }
    }else{
     assert.equal(await page.getByText(heading,{exact:true}).count(),1,'reward sentence appears only as the heading');
     await cards.first().locator('.feed-content-button').click();
     await demo.locator('.feed-card.is-expanded').waitFor();
     await cards.first().getByRole('button',{name:'收起',exact:true}).click();
     await cards.first().getByRole('button',{name:'转发',exact:true}).click();
     await demo.getByText('已转发 1 条（至少 2 条）',{exact:true}).waitFor();
     const before=Number(await demo.getByRole('progressbar').getAttribute('aria-valuenow'));
     await page.waitForTimeout(1200);
     const after=Number(await demo.getByRole('progressbar').getAttribute('aria-valuenow'));
     assert.ok(after<before,'real countdown and meter move');
     await page.waitForFunction(()=>document.querySelector('.tutorial-demo [role="progressbar"]')?.getAttribute('aria-valuenow')==='140',{},{timeout:12000});
     await page.waitForFunction(()=>document.querySelector('.tutorial-demo [role="progressbar"]')?.getAttribute('aria-valuenow')==='150',{},{timeout:3000});
     assert.ok(!(await page.locator('body').innerText()).includes('100 秒'));
    }
    await page.screenshot({path:path.join(out,topic+'-tutorial-'+(i+1)+'.png')});
    await page.getByRole('button',{name:'下一步',exact:true}).click();
   }
   await page.getByRole('button',{name:/^A\./}).click();
   await page.getByText('点击下方按钮后开始 150 秒阅读。',{exact:true}).waitFor();
   await page.getByRole('button',{name:'开始实验',exact:true}).click();
   await page.locator('.feed-card').nth(23).waitFor();
   await page.getByText(topic==='ai'?'AI 帮医生看病':'育儿补贴',{exact:true}).waitFor();
   const labelSelections=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).reading.posts.map(p=>[p.id,p.displayedLabelType,p.displayedLabelText]),key);
   const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../app/data/materials',topic+'.json'))),posts=new Map(Object.values(data.materials).flat().map(p=>[p.id,p]));
   for(const [id,type,text] of labelSelections){
    const p=posts.get(id),card=page.locator(`.feed-card[data-post-id="${id}"]`);
    if(p.sourceLevel==='low'){assert.equal(type,null);assert.equal(await card.locator('.feed-identities').count(),0);}
    else{assert.equal(text,p[type==='identity'?'identityLabel':'platformLabel']);assert.equal(await card.locator('.feed-identities').innerText(),text);}
   }
   const first=page.locator('.feed-card').first(),firstId=await first.getAttribute('data-post-id');
   await first.locator('.feed-content-button').click();await page.waitForTimeout(450);
   await page.screenshot({path:path.join(out,`${topic}-reading.png`)});
   await first.getByRole('button',{name:'收起',exact:true}).click();
   for(let i=0;i<3;i++){
    await page.locator('.feed-card').nth(i).getByRole('button',{name:'转发',exact:true}).click();
    await page.getByRole('button',{name:'确认',exact:true}).click();
   }
   await page.reload();await page.locator('.feed-card').nth(23).waitFor();
   assert.deepEqual(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).reading.posts.map(p=>[p.id,p.displayedLabelType,p.displayedLabelText]),key),labelSelections);
   await page.evaluate(k=>{const s=JSON.parse(localStorage.getItem(k)),real=Date.now()-Number(sessionStorage.getItem('qa_clock_offset')||0);sessionStorage.setItem('qa_clock_offset',String(s.reading.startTime+100100-real));},key);
   await page.getByRole('button',{name:'完成浏览',exact:true}).click();
   await page.getByText(core,{exact:true}).waitFor();
   for(let i=0;i<2;i++){await page.getByRole('radio').nth(2).check();await page.getByRole('button',{name:'下一步',exact:true}).click();}
   await page.getByText('记不清了',{exact:true}).click();await page.getByRole('button',{name:'下一步',exact:true}).click();
   for(let i=0;i<4;i++){
    await page.getByRole('heading',{name:`内容评价（${i+1} / 4）`,exact:true}).waitFor();
    assert.equal(await page.locator('.feed-identities,.feed-actions').count(),0);
    assert.equal(await page.locator('[aria-label="高信源认证"],.ring-amber-400').count(),0);
    await page.screenshot({path:path.join(out,`${topic}-blind.png`)});
    if(i===0){
     // Stress the desktop viewport with the longest actual material, then restore it.
     const text=page.locator('.blind-post > p'), original=await text.innerText();
     const longest=Object.values(data.materials).flat().sort((a,b)=>b.content.length-a.content.length)[0].content;
     await text.evaluate((el,value)=>el.textContent=value,longest);
     if(width>=768){
      for(const [w,h] of [[1280,720],[1366,768],[1440,800]]){
       await page.setViewportSize({width:w,height:h});
       assert.equal(await page.locator('.blind-body').evaluate(el=>el.scrollHeight>el.clientHeight+2),false,'both desktop scales and longest post fit first screen');
       const [a,b]=await page.locator('.blind-scales fieldset').evaluateAll(els=>els.map(el=>({x:el.getBoundingClientRect().x,y:el.getBoundingClientRect().y})));
       assert.ok(b.x>a.x&&Math.abs(a.y-b.y)<2);
      }
      await page.setViewportSize({width,height});
     }
     await page.screenshot({path:path.join(out,topic+'-blind-longest.png')});
     await text.evaluate((el,value)=>el.textContent=value,original);
    }
    await page.locator('input[name="endorsementScore"]').nth(1).check();
    await page.locator('input[name="argumentQualityScore"]').nth(3).check();
    await page.getByRole('heading',{name:'内容评价（'+(i+1)+' / 4）',exact:true}).waitFor();
    await page.locator('input[name="endorsementScore"]').nth(2).check();
    assert.ok(await page.locator('input[name="argumentQualityScore"]').nth(3).isChecked(),'changing first score preserves second');
    await page.locator('input[name="endorsementScore"]').nth(2).check();await page.locator('input[name="argumentQualityScore"]').nth(3).check();
    await page.getByRole('button',{name:i===3?'继续':'下一条',exact:true}).click();
   }
   await page.locator('#explanation-text').waitFor();assert.ok(!/2000|工作机会|就业/.test(await page.locator('body').innerText()));
   await page.locator('#explanation-text').fill('这是新版语料本机隔离验收，用于核对议题文案、版本号、盲评和行为数据完整保存。');
   await page.getByRole('button',{name:'提交',exact:true}).click();
   await page.getByRole('radio').nth(1).check();await page.getByRole('button',{name:'提交',exact:true}).click();
   await page.getByRole('heading',{name:'本部分已完成',exact:true}).waitFor();
   const saved=await(await fetch('http://127.0.0.1:3211/_qa/state?uid='+uid)).json();
   assert.equal(saved.session.questionnaire_version,'2026-11-25-v5');assert.equal(saved.session.topic_key,topic);assert.ok(saved.session.completed_at);
   assert.equal(saved.session.blinded_post_evaluations.answers.length,4);assert.equal(saved.counts.actions,3);
   assert.ok(saved.session.reading_metrics.detailIntervals.some(v=>v.postId===firstId&&v.durationMs>0));
   assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   fs.writeFileSync(path.join(out,`${topic}-result.json`),JSON.stringify({uid,passed:true,version:saved.session.questionnaire_version,counts:saved.counts,labels:labelSelections},null,2));
   console.log(`PASS ${topic}: n=24, ${width}px, complete saved with v5 labels/reading/actions/blind data`);
   await context.close();
  }
 }catch(e){if(page){await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'failure.txt'),await page.locator('body').innerText().catch(()=>''));}throw e;}
 finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
