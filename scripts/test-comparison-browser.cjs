// Isolated QA only. Exercises timeout with 0/1 share and persisted fallback candidates.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const out=path.join(require('node:os').tmpdir(),'labweb-comparison-edge-20261126');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});let page;
 try{for(const k of [0,1]){
  const context=await browser.newContext({viewport:{width:k?1280:390,height:k?720:844},isMobile:!k,hasTouch:!k});
  page=await context.newPage();page.setDefaultTimeout(20000);const uid='test_comparison_edge_'+k+'_'+Date.now(),key='labweb:session:v5:'+uid;
  await page.addInitScript(()=>{const real=Date.now;Date.now=()=>real()+Number(sessionStorage.getItem('qa_clock_offset')||0);Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:()=>Promise.reject(new DOMException('QA','NotAllowedError'))});});
  await page.goto('http://127.0.0.1:3210/?uid='+uid+'&n=8&topic=ai');
  await page.getByRole('button',{name:'进入实验',exact:true}).click();
  for(let i=0;i<5;i++){await page.getByRole('radio').nth(2).check();await page.getByRole('button',{name:'下一步',exact:true}).click();}
  for(let i=0;i<3;i++)await page.getByRole('button',{name:'下一步',exact:true}).click();
  await page.getByRole('button',{name:/^A\./}).click();await page.getByRole('button',{name:'开始实验',exact:true}).click();await page.locator('.feed-card').nth(7).waitFor();
  if(k){await page.locator('.feed-card').first().getByRole('button',{name:'转发',exact:true}).click();await page.getByRole('button',{name:'确认',exact:true}).click();}
  await page.evaluate(key=>{const s=JSON.parse(localStorage.getItem(key)),real=Date.now()-Number(sessionStorage.getItem('qa_clock_offset')||0);sessionStorage.setItem('qa_clock_offset',String(s.reading.startTime+150100-real));},key);
  await page.getByRole('radio').first().waitFor();
  for(let i=0;i<2;i++){await page.getByRole('radio').nth(2).check();await page.getByRole('button',{name:'下一步',exact:true}).click();}
  if(k){await page.getByText('记不清了',{exact:true}).click();await page.getByRole('button',{name:'下一步',exact:true}).click();}
  for(let i=0;i<4;i++){await page.getByRole('heading',{name:'内容评价（'+(i+1)+' / 4）',exact:true}).waitFor();await page.locator('input[name="endorsementScore"]').nth(2).check();await page.locator('input[name="argumentQualityScore"]').nth(2).check();await page.getByRole('button',{name:i===3?'继续':'下一条',exact:true}).click();}
  await page.getByRole('heading',{name:'观点对比',exact:true}).waitFor();assert.equal(await page.locator('.comparison-question').first().getByRole('radio').count(),3);
  await page.locator('input[name="mostAlignedPostId"]').nth(0).check();assert.equal(await page.locator('input[name="leastAlignedPostId"]').count(),2);await page.locator('input[name="leastAlignedPostId"]').nth(0).check();
  await page.getByRole('button',{name:'继续',exact:true}).click();await page.locator('#explanation-text').fill('这是比较题候选不足情况下的隔离验收，用于检查补充候选、来源标记和完整保存。');
  await page.getByRole('button',{name:'提交',exact:true}).click();await page.getByRole('radio').nth(1).check();await page.getByRole('button',{name:'提交',exact:true}).click();await page.getByRole('heading',{name:'本部分已完成',exact:true}).waitFor();
  const saved=await(await fetch('http://127.0.0.1:3211/_qa/state?uid='+uid)).json(),c=saved.session.posttest.bestWorstComparison;
  assert.ok(saved.session.completed_at);assert.equal(c.candidateIds.length,3);assert.equal(Object.values(c.candidateSources).filter(s=>s==='fallback').length,2-k);assert.ok(c.answeredAt);assert.ok(c.durationMs>0);
  fs.writeFileSync(path.join(out,'result-'+k+'.json'),JSON.stringify({uid,shares:k,passed:true,comparison:c},null,2));console.log('PASS shares='+k+': timeout, 3 candidates, '+(2-k)+' fallback sources, completed database JSON');await context.close();
 }}catch(e){if(page){await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'failure.txt'),await page.locator('body').innerText().catch(()=>''));}throw e;}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
