// Start isolated qa-server.cjs and qa-app.cjs. No production data is used.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const out=path.join(require('node:os').tmpdir(),'labweb-dual-zone-20261126');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});let page;
 try{
  for(const n of [8,24,48]){
   const context=await browser.newContext({viewport:{width:1440,height:800}});page=await context.newPage();page.setDefaultTimeout(20000);
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{
    window.__pairPins=[];
    document.addEventListener('click',event=>{
     const card=event.target.closest?.('main.reading-feed .feed-card');
     if(!card||card.classList.contains('is-expanded')||event.target.closest('.feed-actions'))return;
     const entry={id:card.dataset.postId,top:card.getBoundingClientRect().top,frames:[]};
     window.__pairPins.push(entry);
     const sample=()=>{entry.frames.push(card.getBoundingClientRect().top);if(entry.frames.length<16)requestAnimationFrame(sample)};
     requestAnimationFrame(sample);
    },true);
   });
   const uid='test_dual_zone_'+n+'_'+Date.now(),key='labweb:session:v5:'+uid;
   const read=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
   await page.goto('http://127.0.0.1:3210/?uid='+uid+'&n='+n+'&topic=fertility');
   await page.getByRole('button',{name:'进入实验',exact:true}).click();
   for(let i=0;i<5;i++){await page.getByRole('radio').nth(2).check();await page.getByRole('button',{name:'下一步',exact:true}).click();}
   await page.getByRole('button',{name:'开始操作教程',exact:true}).click();
  for(let i=0;i<3;i++){await page.waitForFunction(()=>document.querySelector('.tutorial-demo')?.dataset.manual==='true');await page.getByRole('button',{name:'下一步',exact:true}).click();}
   await page.getByRole('button',{name:/^A\./}).click();await page.getByText('点击下方按钮后开始 150 秒阅读。',{exact:true}).waitFor();await page.getByRole('button',{name:'开始实验',exact:true}).click();
   const grid=page.locator('main.reading-feed .dual-zone-feed');await grid.waitFor();await page.waitForTimeout(400);
   assert.equal(await grid.getAttribute('data-columns'),'4');
   assert.equal(await page.locator('main.reading-feed').evaluate(el=>getComputedStyle(el).overflowAnchor),'none');
   const state=await read(),ids=state.reading.posts.map(p=>p.id);
   assert.equal(state.reading.metrics.packingVersion,'dual-zone-grid-v1');
   for(const [i,id]of ids.entries()){
    const item=grid.locator('[data-post-key="'+id+'"]');
    assert.equal(Number(await item.getAttribute('data-zone')),Math.floor(i/2)%2);

   }
   const geometry=zone=>grid.locator('.dual-zone-half[data-zone-index="'+zone+'"] .feed-card').evaluateAll(nodes=>{
    const root=nodes[0].closest('.dual-zone-feed').getBoundingClientRect();
    return nodes.map(el=>{const r=el.getBoundingClientRect();return {id:el.dataset.postId,x:r.x-root.x,y:r.y-root.y,w:r.width,h:r.height}});
   });
   for(const [i,id]of ids.entries()){
    const card=grid.locator('.feed-card[data-post-id="'+id+'"]'),zone=Math.floor(i/2)%2;
    await card.scrollIntoViewIfNeeded();await page.waitForTimeout(50);
    const opposite=await geometry(1-zone);
    await card.locator('.feed-content-button').click();
    await page.waitForTimeout(110);assert.deepEqual(await geometry(1-zone),opposite,'opposite half stays still during animation');
    await page.waitForTimeout(220);assert.deepEqual(await geometry(1-zone),opposite,'opposite half stays still after expansion');
    assert.equal(await card.locator('..').getAttribute('data-column-span'),'2');
    const pin=await page.evaluate(id=>window.__pairPins.filter(x=>x.id===id).at(-1),id);
    assert.ok(pin.frames.length>=2);
    assert.ok(pin.frames.every(y=>Math.abs(y-pin.top)<=4),'clicked card stays pinned from first animation frame: '+JSON.stringify(pin));
    await card.getByRole('button',{name:'收起',exact:true}).click();await page.waitForTimeout(330);
    assert.deepEqual(await geometry(1-zone),opposite,'opposite half stays still after collapse');
    assert.ok((await card.getAttribute('class')).includes('is-read'));
   }
   // Switching a middle/lower card globally closes the prior expansion.
   for(const id of [ids[Math.floor(n/8)*4],ids[Math.floor(n/8)*4+1],ids[Math.floor(n/8)*4+2],ids[Math.floor(n/8)*4+3]]){
    const previous=(await read()).reading.metrics.openDetailIds[0];
    await grid.locator('.feed-card[data-post-id="'+id+'"] .feed-content-button').click();await page.waitForTimeout(350);
    assert.equal(await grid.locator('.is-expanded').count(),1);
    if(previous){const events=(await read()).reading.metrics.detailEvents;assert.equal(events.filter(e=>e.postId===previous&&e.type==='close').at(-1).timestamp,events.filter(e=>e.postId===id&&e.type==='open').at(-1).timestamp);}
    if(n===48){const pin=await page.evaluate(id=>window.__pairPins.filter(x=>x.id===id).at(-1),id);assert.ok(pin.frames.every(y=>Math.abs(y-pin.top)<=4),'continuous middle/lower switching must stay pinned: '+JSON.stringify(pin));}
   }
   assert.equal(await grid.locator('.is-expanded').count(),1);
   await page.reload();await grid.locator('.is-expanded').first().waitFor();await page.waitForTimeout(400);
   assert.equal((await read()).reading.metrics.openDetailIds.length,1);
   for(const size of [{width:1280,height:720},{width:1440,height:800}]){
    await page.setViewportSize(size);await page.waitForTimeout(400);
    assert.equal(await grid.getAttribute('data-columns'),'4');
   }
   assert.equal(await grid.locator('.is-expanded').count(),1);
   for(const half of await grid.locator('.dual-zone-half').all()){
    assert.ok(await half.evaluate(el=>{const rows=new Map();for(const node of el.children){rows.set(node.offsetTop,(rows.get(node.offsetTop)||0)+Number(node.dataset.columnSpan));}const ordered=[...rows.entries()].sort((a,b)=>a[0]-b[0]);return ordered.slice(0,-1).every(([,slots])=>slots===2)}),'only bottom row may have an empty cell');
   }
   await page.screenshot({path:path.join(out,'desktop-'+n+'.png')});
   await page.setViewportSize({width:768,height:1024});await page.waitForTimeout(400);
   assert.equal(await grid.getAttribute('data-columns'),'2');
   assert.equal(await grid.locator('.dual-zone-half').count(),1);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.deepEqual(errors,[]);
   fs.writeFileSync(path.join(out,'result-'+n+'.json'),JSON.stringify({uid,n,passed:true,cardsTested:ids.length,oppositeHalfDisplacement:0,singleOpen:true,firstFramePinTolerance:4,errors},null,2));
   console.log('PASS n='+n+': every card locks its half, compact single-open, clicked card <=4px from first frame, opposite half 0px, read state, single-open/reload, 4/2-column resize');
   await context.close();
  }
 }catch(e){if(page){await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'failure.txt'),await page.locator('body').innerText().catch(()=>''));}throw e;}
 finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
