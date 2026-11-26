const test=require('node:test'),assert=require('node:assert/strict');
const {createLoader}=require('./test-support.cjs'),{blindFixture}=require('./test-blinded-support.cjs');
const load=createLoader(),c=load('app/protocol/v5/lib/bestWorstComparison.ts'),v=load('app/protocol/v5/lib/submissionValidation.ts');
const rp=load('app/protocol/v5/lib/readingProtocol.ts');
const postsFor=topic=>new Map(Object.values(load('app/lib/materialsRegistry.ts').getMaterialsForTopic(topic).materials).flat().map(p=>[p.id,p]));
function comparisonFixture(topic='ai',n=24,k=3){
 const f=blindFixture(topic,n,'test_comparison_'+topic+'_'+n+'_'+k,k),posts=postsFor(topic);
 f.readingMetrics.interactionVersion=rp.SINGLE_OPEN_COMPARISON_VERSION;
 let response=c.newComparison(f,posts,f.blindedPostEvaluations.completedAt+1,271828);
 response.presentedAt=response.generatedAt+1;
 response=c.chooseComparison(response,'mostAlignedPostId',response.candidateIds[0]);response=c.chooseComparison(response,'leastAlignedPostId',response.candidateIds[1]);
 response=c.finishComparison(response,response.presentedAt+1200);f.posttest.bestWorstComparison=response;
 const end=Date.parse(response.answeredAt);f.explanation.startedAt=end+1;f.explanation.completedAt=end+500;
 f.posttest.answers[2].startedAt=end+501;f.posttest.answers[2].answeredAt=end+502;f.posttest.completedAt=end+503;return f;
}
module.exports={comparisonFixture};

test('比较池3–6条、转发最多3条、互动贴最多5条，零互动fallback显式记录且固定seed同序',()=>{
 for(const topic of ['ai','fertility'])for(const n of [8,24,48])for(const k of [0,1,2,5,n]){
  const f=blindFixture(topic,n,'test_sample',k),posts=postsFor(topic),pool=c.sampleComparison(f,posts,123);
  assert.ok(pool.candidateIds.length>=3&&pool.candidateIds.length<=6);assert.equal(new Set(pool.candidateIds).size,pool.candidateIds.length);
  assert.equal(Object.values(pool.candidateSources).filter(s=>s==='shared').length,Math.min(3,k));
  assert.ok(Object.values(pool.candidateSources).filter(s=>['shared','liked_only'].includes(s)).length<=5);
  assert.deepEqual(c.sampleComparison(JSON.parse(JSON.stringify(f)),posts,123),pool);
  if(k===0){assert.equal(Object.values(pool.candidateSources).filter(s=>s==='fallback').length,2);assert.ok(pool.fallbackReasons.includes('insufficient_interaction_candidates'));}
  if(k===n){assert.equal(pool.controlRule,'unavailable');assert.ok(pool.fallbackReasons.includes('no_uninteracted_control'));}
 }
});
test('参考立场取最终转发多数或前测打破平局，取消转发和取消点赞不误标为互动候选',()=>{
 const f=blindFixture('ai',8,'test_reference',0),posts=postsFor('ai');
 const support=f.postOrder.filter(id=>posts.get(id).stance==='support'),oppose=f.postOrder.filter(id=>posts.get(id).stance==='oppose');
 const action=(type,postId)=>({type,postId});
 f.actions=[action('share',support[0]),action('share',oppose[0])];f.pretest.answers[0].value=5;
 assert.equal(c.sampleComparison(f,posts,99).referenceStance,'support');assert.equal(c.sampleComparison(f,posts,99).referenceStanceRule,'pretest_tiebreak');
 f.pretest.answers[0].value=1;assert.equal(c.sampleComparison(f,posts,99).referenceStance,'oppose');
 f.pretest.answers[0].value=3;assert.equal(c.sampleComparison(f,posts,99).referenceStanceRule,'random_tiebreak');
 f.actions.push(action('share',support[1]));assert.equal(c.sampleComparison(f,posts,99).referenceStanceRule,'shared_majority');
 f.actions.push(action('unshare',oppose[0]),action('like',oppose[1]),action('unlike',oppose[1]));
 const pool=c.sampleComparison(f,posts,99);assert.notEqual(pool.candidateSources[oppose[0]],'shared');assert.notEqual(pool.candidateSources[oppose[1]],'liked_only');
});
test('对照优先从未展开且从未点赞转发，再同立场、任意未互动；点赞补充不超过5条互动候选',()=>{
 const f=blindFixture('fertility',24,'test_control',0),posts=postsFor('fertility'),support=f.postOrder.filter(id=>posts.get(id).stance==='support');
 f.pretest.answers[0].value=5;f.actions=[{type:'share',postId:support[0]},{type:'share',postId:support[1]}];
 f.readingMetrics.detailEvents=support.slice(2,-1).map(postId=>({type:'open',postId}));
 let pool=c.sampleComparison(f,posts,42);assert.equal(pool.controlRule,'unopened_uninteracted');assert.equal(pool.candidateSources[support.at(-1)],'same_stance_uninteracted');
 f.readingMetrics.detailEvents.push({type:'open',postId:support.at(-1)});assert.equal(c.sampleComparison(f,posts,42).controlRule,'same_stance_final_uninteracted');
 f.actions=support.map(postId=>({type:'share',postId}));assert.equal(c.sampleComparison(f,posts,42).controlRule,'any_final_uninteracted');
 f.actions=[{type:'share',postId:support[0]},...f.postOrder.slice(1,10).map(postId=>({type:'like',postId}))];pool=c.sampleComparison(f,posts,42);
 assert.equal(Object.values(pool.candidateSources).filter(s=>s==='shared'||s==='liked_only').length,5);
});
test('比较选择互斥、耗时与ISO时间记录完整；服务端拒绝篡改候选、来源、立场、答案和跳题',()=>{
 for(const topic of ['ai','fertility']){
  const f=comparisonFixture(topic);assert.ok(v.validSubmission(f));
  for(const mutate of [g=>g.posttest.bestWorstComparison.candidateIds.reverse(),g=>g.posttest.bestWorstComparison.referenceStance='bad',g=>g.posttest.bestWorstComparison.durationMs++,g=>g.posttest.bestWorstComparison.answeredAt='bad',g=>g.posttest.bestWorstComparison.leastAlignedPostId=g.posttest.bestWorstComparison.mostAlignedPostId,g=>g.posttest.bestWorstComparison.candidateSources[g.posttest.bestWorstComparison.candidateIds[0]]='bad',g=>delete g.posttest.bestWorstComparison]){
   const bad=structuredClone(f);mutate(bad);assert.equal(v.validSubmission(bad),false);
  }
  const legacy=structuredClone(f);delete legacy.posttest.bestWorstComparison;delete legacy.readingMetrics.interactionVersion;assert.ok(v.validSubmission(legacy));
  let draft=c.newComparison(f,postsFor(topic),f.blindedPostEvaluations.completedAt+1,7);draft.presentedAt=draft.generatedAt;
  const id=draft.candidateIds[0];draft=c.chooseComparison(draft,'mostAlignedPostId',id);draft=c.chooseComparison(draft,'leastAlignedPostId',id);assert.equal(draft.mostAlignedPostId,null);assert.throws(()=>c.finishComparison(draft));
 }
});
test('新阅读单开自动收尾上一张全文区间，旧无单开标记数据仍兼容',()=>{
 const f=blindFixture('ai',8),all=postsFor('ai'),posts=f.postOrder.map(id=>({...all.get(id),displayName:'test'}));
 const tracker=new rp.ReadingTracker(posts),[a,b]=f.postOrder,t=f.startTime;
 tracker.open(a,t,0,true);tracker.resumeDetail(t+10,a);tracker.open(b,t+300,0,true);tracker.resumeDetail(t+310,b);tracker.close(t+600,b);
 assert.deepEqual(tracker.metrics.openDetailIds,[]);assert.ok(tracker.metrics.detailEvents.some(e=>e.type==='close'&&e.postId===a&&e.timestamp===t+300));
 assert.equal(tracker.metrics.detailIntervals.find(i=>i.postId===a).endMs,t+300);assert.equal(tracker.metrics.detailIntervals.find(i=>i.postId===b).endMs,t+600);
});
