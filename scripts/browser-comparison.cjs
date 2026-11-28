const assert = require('node:assert/strict'), path = require('node:path');
// Shared interaction checks for the two separately navigated comparison questions.
async function checkComparisonPages(page, key, out, name) {
 const heading = text => page.getByRole('heading',{name:text,exact:true});
 const mostTitle='哪条内容最符合你的想法？',leastTitle='哪条内容最不符合你的想法？';
 const read=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)).posttest.bestWorstComparison,key);
 await heading(mostTitle).waitFor();
 const ids=(await read()).candidateIds;
 assert.equal(await page.locator('.comparison-question').count(),1);
 assert.equal(await page.locator('input[name="mostAlignedPostId"]').count(),ids.length);
 assert.equal(await page.locator('input[name="leastAlignedPostId"]').count(),0);
 assert.equal(await page.locator('.feed-identities,.feed-actions,.feed-author,.feed-avatar,[aria-label="高信源认证"],.comparison-card img').count(),0);
 const next=page.getByRole('button',{name:'下一步',exact:true});assert.ok(await next.isDisabled());
 await page.locator('input[name="mostAlignedPostId"]').nth(0).check();await heading(mostTitle).waitFor();
 const firstDraft=await read();await page.reload();await heading(mostTitle).waitFor();assert.deepEqual(await read(),firstDraft);
 assert.ok(await page.locator('input[name="mostAlignedPostId"]').nth(0).isChecked());
 await page.screenshot({path:path.join(out,name+'-comparison-most.png')});
 await page.locator('.comparison-body').evaluate(el=>el.scrollTop=el.scrollHeight);
 await next.click();await heading(leastTitle).waitFor();
 assert.equal(await page.locator('.comparison-question').count(),1);
 assert.equal(await page.locator('input[name="mostAlignedPostId"]').count(),0);
 assert.equal(await page.locator('input[name="leastAlignedPostId"]').count(),ids.length-1);
 assert.equal(await page.locator('input[value="'+ids[0]+'"]').count(),0);
 assert.equal(await page.locator('.comparison-body').evaluate(el=>el.scrollTop),0);
 const proceed=page.getByRole('button',{name:'继续',exact:true});assert.ok(await proceed.isDisabled());
 await page.locator('input[name="leastAlignedPostId"]').nth(0).check();await heading(leastTitle).waitFor();
 await page.getByRole('button',{name:'上一题',exact:true}).click();await heading(mostTitle).waitFor();
 assert.ok(await page.locator('input[name="mostAlignedPostId"]').nth(0).isChecked());
 await page.locator('input[name="mostAlignedPostId"]').nth(1).check();await next.click();await heading(leastTitle).waitFor();
 assert.equal(await page.locator('.comparison-question input:checked').count(),0,'changing best to previous least clears the second answer');
 assert.equal(await page.locator('input[value="'+ids[1]+'"]').count(),0);assert.ok(await proceed.isDisabled());
 await page.locator('input[value="'+ids[0]+'"]').check();
 const secondDraft=await read();await page.reload();await heading(leastTitle).waitFor();assert.deepEqual(await read(),secondDraft);
 assert.ok(await page.locator('input[value="'+ids[0]+'"]').isChecked());
 assert.equal(await page.locator('input[name="leastAlignedPostId"]').count(),ids.length-1);
 await page.screenshot({path:path.join(out,name+'-comparison-least.png')});
 await proceed.click();await page.locator('#explanation-text').waitFor();
}
module.exports={checkComparisonPages};
