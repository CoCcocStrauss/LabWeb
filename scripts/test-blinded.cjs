const test=require('node:test'),assert=require('node:assert/strict'),{createLoader}=require('./test-support.cjs'),{blindFixture}=require('./test-blinded-support.cjs'),load=createLoader();const v=load('app/protocol/v5/lib/submissionValidation.ts'),b=load('app/protocol/v5/lib/blinded.ts');
test('新版六条件与核心题一致、24条三个正交区组、旧16入口隔离',()=>{const q=load('app/protocol/v5/data/questionnaire.ts');for(const topic of ['ai','fertility'])for(const n of [8,24,48]){assert.deepEqual(q.getQuestions(topic,'pretest')[0],q.getQuestions(topic,'posttest')[0]);const f=blindFixture(topic,n);assert.equal(f.postOrder.length,n);assert.equal(new Set(f.postOrder).size,n);assert.ok(v.validSubmission(f),topic+n);}assert.equal(v.validPretest(blindFixture('ai',16)),false);});
test('0/1/2/4/全部转发均有四帖盲评，无重复、固定seed恢复同序',()=>{for(const k of [0,1,2,4,8]){const f=blindFixture('ai',8,'test_sample_'+k,k);assert.ok(v.validSubmission(f),'shares '+k);const r=f.blindedPostEvaluations;assert.equal(r.items.length,4);assert.equal(new Set(r.order).size,4);assert.deepEqual(JSON.parse(JSON.stringify(r)).order,r.order);if(k===8)assert.equal(f.recognition.skipReason,'insufficient_distractors');}});
test('转发取消与重选按最终集合；恶意盲评候选/评分/原文被拒绝',()=>{assert.deepEqual(b.activeShares([{type:'share',postId:'a'},{type:'unshare',postId:'a'},{type:'share',postId:'b'}]),['b']);for(const mutate of [f=>f.blindedPostEvaluations.items[0].content='伪造',f=>f.blindedPostEvaluations.answers[0].endorsementScore=6,f=>f.blindedPostEvaluations.order[0]='不存在',f=>f.finalShareCount=12,f=>f.readingMetrics.alerts.push({})]){const f=blindFixture();mutate(f);assert.equal(v.validSubmission(f),false);}});
test('100秒前手动结束拒绝，150秒超时允许未达标，三步教程不泄露100秒',()=>{const f=blindFixture();f.endReason='manual';f.endTime=f.startTime+99000;f.unlockShownAtMs=f.endTime;assert.equal(v.validSubmission(f),false);assert.ok(v.validSubmission(blindFixture('fertility',24,'test_zero',0)));const p=load('app/protocol/v5/lib/readingProtocol.ts');assert.equal(p.TUTORIAL_STEPS.length,3);assert.ok(!JSON.stringify(p.TUTORIAL_STEPS).includes('100')); });
test('盲评对照优先取仅点赞最高曝光，未互动池优先展开过全文',()=>{const f=blindFixture('ai',8),ids=f.postOrder;for(const j of [2,3])f.actions.push({type:'like',postId:ids[j]});for(const [j,ms]of [[2,500],[3,1000],[4,3000],[5,20]])f.postVisibilitySummary[ids[j]].totalVisibleMs=ms;f.readingMetrics.detailEvents.push({postId:ids[5],type:'open'});const all=new Map(Object.values(load('app/lib/materialsRegistry.ts').getMaterialsForTopic('ai').materials).flat().map(p=>[p.id,p])),s=b.sampleBlind(f,all,123);assert.ok(s.items.some(x=>x.postId===ids[3]&&x.sampleRole==='liked_only'));assert.ok(s.items.some(x=>x.postId===ids[5]&&x.sampleRole==='seen_uninteracted'));});

test('全文可见区间分段，滚出／切屏停止，收起后短卡继续且不重复累计',()=>{
 const {trackedBlindFixture}=require('./test-blinded-support.cjs'),f=trackedBlindFixture(),id=f.postOrder[0],s=f.startTime;
 assert.ok(v.validSubmission(f));
 assert.deepEqual(f.readingMetrics.detailIntervals.map(i=>[i.postId,i.startMs-s,i.endMs-s,i.durationMs]),[
  [id,510,1510,1000],[id,2010,2510,500],[id,3010,4010,1000],
 ]);
 assert.equal(f.postVisibilitySummary[id].totalVisibleMs,1000);
 assert.deepEqual(f.scrollEvents.map(e=>[e.action,e.timestamp-s]),[['enter_viewport',0],['leave_viewport',500],['enter_viewport',4010],['leave_viewport',4510]]);
 for(const mutate of [g=>g.readingMetrics.detailIntervals[0].durationMs++,g=>delete g.readingMetrics.detailIntervals[0].startMs,g=>{
  const e=g.scrollEvents.find(e=>e.action==='leave_viewport');e.timestamp=s+1000;
 }]){const g=structuredClone(f);mutate(g);assert.equal(v.validSubmission(g),false);}
});

test('旧多开进度可见快照不重复，刷新不累计间隙，独立收尾并忽略迟到回调',()=>{
 const f=blindFixture(),all=Object.values(load('app/lib/materialsRegistry.ts').getMaterialsForTopic(f.topicKey).materials).flat(),posts=f.presentedPosts.map(p=>({...all.find(x=>x.id===p.postId),...p,id:p.postId}));
 const {ReadingTracker}=load('app/protocol/v5/lib/readingProtocol.ts'),t=new ReadingTracker(posts),[a,c]=f.postOrder,s=f.startTime;
 delete t.metrics.interactionVersion;
 t.setVisible(a,true,s,0);t.open(a,s+300,0,true);t.setVisible(a,true,s+310,0);t.resumeDetail(s+320,a);
 t.open(c,s+400,0,true);t.resumeDetail(s+420,c);t.stopDetail(s+500,c);t.resumeDetail(s+600,c);
 const first=t.snapshot(s+800,0,[]),again=t.snapshot(s+900,0,[]);
 assert.equal(first.visibility[a].totalVisibleMs,300);
 assert.equal(first.metrics.detailIntervals.filter(i=>i.postId===a).length,1);
 assert.equal(again.metrics.detailIntervals.find(i=>i.postId===a).durationMs,580);
 const restored=new ReadingTracker(posts,{metrics:again.metrics,scrollEvents:again.events,postVisibilitySummary:again.visibility});
 restored.resumeDetail(s+5000,a);restored.resumeDetail(s+5100,c);restored.suspend(s+5300,0);restored.resumeDetail(s+5500,a);restored.close(s+5700);
 restored.resumeDetail(s+5800,a);restored.resumeDetail(s+5800,'unknown');
 const final=restored.snapshot(s+6000,0,[]),totals=id=>final.metrics.detailIntervals.filter(i=>i.postId===id).reduce((sum,i)=>sum+i.durationMs,0);
 assert.equal(totals(a),1080);assert.equal(totals(c),580);assert.equal(final.visibility[a].totalVisibleMs,300);
 assert.deepEqual(final.metrics.openDetailIds,[]);
 for(const i of final.metrics.detailIntervals){assert.equal(i.startMs,i.startedAt);assert.equal(i.endMs,i.endedAt);assert.equal(i.durationMs,i.endMs-i.startMs);assert.ok(i.durationMs>0);}
});

test('三步教程使用交接原文，无复选框，步骤及标签选择刷新保留',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),rp=load('app/protocol/v5/lib/readingProtocol.ts'),{TutorialPage}=load('app/protocol/v5/components/TutorialPage.tsx');
 let rules=rp.newRules(1000);const labels=structuredClone(rules.demoLabelSelections);
 assert.deepEqual(rules.items.map(i=>i.id),['step_1','step_2','step_3']);
 const html=renderToStaticMarkup(React.createElement(TutorialPage,{response:rules,onChange(){},onStart(){}}));
 assert.ok(html.includes(rp.TUTORIAL_STEPS[0].text));assert.ok(!html.includes('type="checkbox"'));assert.equal((html.match(/data-post-id="demo-a"/g)||[]).length,1);
 for(const [i,step]of rp.TUTORIAL_STEPS.entries()){rules=rp.enterTutorialStep(rules,step.id,1000+i*10);rules=rp.completeTutorialStep(rules,step.id,1005+i*10);}
 const completed=structuredClone(rules);rules=rp.enterTutorialStep(rules,'step_1',1030);rules=rp.completeTutorialStep(rules,'step_1',1040);
 assert.deepEqual(rules.items,completed.items);assert.deepEqual(rules.demoLabelSelections,labels);
 const restored=JSON.parse(JSON.stringify(rules));assert.equal(restored.activeStep,'step_1');assert.deepEqual(restored.items,completed.items);
});

test('新三步时间戳校验与旧四条规则均可提交，漏步骤及倒置时间被拒绝',()=>{
 const f=blindFixture(),legacy=load('app/protocol/v5/lib/readingProtocol.ts');assert.ok(v.validSubmission(f));assert.equal(f.rules.items.length,3);
 for(const mutate of [g=>g.rules.overviewEnteredAt=null,g=>g.rules.overviewCompletedAt=null,g=>g.rules.overviewCompletedAt=g.rules.items[0].enteredAt+1,g=>g.rules.overviewEnteredAt=g.rules.startedAt-1]){const g=structuredClone(f);mutate(g);assert.equal(v.validSubmission(g),false);}
 const old=structuredClone(f);old.rules.presentationVersion=legacy.LEGACY_TUTORIAL_VERSION;delete old.rules.overviewEnteredAt;delete old.rules.overviewCompletedAt;assert.ok(v.validSubmission(old),'in-flight v1 tutorial still saves');

 for(const mutate of [g=>g.rules.items.pop(),g=>g.rules.items[1].enteredAt=null,g=>g.rules.items[2].completedAt=g.rules.startedAt,g=>g.rules.activeStep='step_1']){const g=structuredClone(f);mutate(g);assert.equal(v.validSubmission(g),false);}
 f.rules=legacy.newRules(f.pretest.completedAt+1);delete f.rules.presentationVersion;delete f.rules.activeStep;f.rules.items=legacy.RULES.map(([id],i)=>({id,checked:true,changedAt:f.rules.startedAt+i+1}));f.rules.completedAt=f.rules.startedAt+10;assert.ok(v.validSubmission(f));
});

test('切屏次数去重、快照与恢复累计离开时间，全文不累计隐藏间隙',()=>{
 const f=blindFixture(),all=Object.values(load('app/lib/materialsRegistry.ts').getMaterialsForTopic(f.topicKey).materials).flat(),posts=f.presentedPosts.map(p=>({...all.find(x=>x.id===p.postId),...p,id:p.postId}));
 const {ReadingTracker}=load('app/protocol/v5/lib/readingProtocol.ts'),t=new ReadingTracker(posts),id=posts[0].id,s=f.startTime;
 t.setVisible(id,true,s,0);t.open(id,s+300,0,true);t.resumeDetail(s+300,id);t.hide(s+1000,0);t.hide(s+1100,0);t.resumeDetail(s+1200,id);t.setVisible(id,true,s+1300,0);
 const snap=t.snapshot(s+4000,0,[]);assert.equal(snap.metrics.hiddenCount,1);assert.equal(snap.metrics.totalHiddenMs,3000);assert.equal(snap.metrics.detailIntervals.reduce((n,i)=>n+i.durationMs,0),700);assert.equal(snap.visibility[id].totalVisibleMs,300);
 const r=new ReadingTracker(posts,{metrics:snap.metrics,scrollEvents:snap.events,postVisibilitySummary:snap.visibility,savedAt:s+4000});assert.equal(r.show(s+7000),true);assert.equal(r.show(s+7100),false);
 r.resumeDetail(s+8000,id);r.hide(s+9000,0);r.show(s+12000);r.close(s+13000);const end=r.snapshot(s+14000,0,[]);
 assert.equal(end.metrics.hiddenCount,2);assert.equal(end.metrics.totalHiddenMs,9000);assert.equal(end.metrics.hiddenAtMs,null);assert.equal(end.metrics.detailIntervals.reduce((n,i)=>n+i.durationMs,0),1700);
});

test('24条取消转发后，不成为再认目标或盲评转发池候选',()=>{
 const f=blindFixture('fertility',24,'test_24_unshare',3),id=f.postOrder[0],all=Object.values(load('app/lib/materialsRegistry.ts').getMaterialsForTopic(f.topicKey).materials).flat(),posts=f.presentedPosts.map(p=>({...all.find(x=>x.id===p.postId),...p,id:p.postId})),pt=load('app/protocol/v5/lib/posttest.ts');
 f.actions.push({...f.actions[0],type:'unshare',timestamp:f.startTime+1000});f.finalShareCount=2;f.readingMetrics.taskGoal.actualShares=2;
 f.recognition=pt.createRecognition(posts,f.actions,f.posttest.answers[1].answeredAt+1);f.recognition.presentedAt=f.recognition.generatedAt;f.recognition=pt.answerRecognition(f.recognition,'not_sure',f.recognition.generatedAt+1);
 f.blindedPostEvaluations=b.newBlind(f,new Map(all.map(p=>[p.id,p])),f.recognition.answeredAt+1,123);let t=f.blindedPostEvaluations.generatedAt;for(const a of f.blindedPostEvaluations.answers){a.presentedAt=++t;a.endorsementScore=3;a.argumentQualityScore=3;a.answeredAt=++t;}f.blindedPostEvaluations.completedAt=++t;
 assert.notEqual(f.recognition.targetPostId,id);assert.ok(!f.blindedPostEvaluations.items.some(i=>i.postId===id&&i.sampleRole==='shared'));assert.ok(v.validSubmission(f));
});

test('800元与AI医疗版本、前后核心题及材料情境一致，单标签不产生空占位',()=>{
 const q=load('app/protocol/v5/data/questionnaire.ts'),{chooseDisplayedLabel}=load('app/lib/labelSelection.ts'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{PostAuthor}=load('app/components/CompactPostCard.tsx');
 assert.equal(q.QUESTIONNAIRE_VERSION,'2026-11-25-v5');
 for(const topic of ['fertility','ai']){
  const data=load('app/data/materials/'+topic+'.json');assert.equal(data.topic,q.coreQuestion(topic).text);assert.equal(data.topicDescription,q.QUESTIONNAIRES[topic].scenario);
  const posts=Object.values(data.materials).flat();assert.equal(posts.length,48);
  assert.equal(posts.filter(p=>p.sourceLevel==='high').length,24);
  for(const p of posts){
   const selected=chooseDisplayedLabel(p,()=>0),html=renderToStaticMarkup(React.createElement(PostAuthor,{post:{...p,...selected,displayName:'测试昵称'},compact:true}));
   assert.equal((html.match(/class="feed-identities"/g)||[]).length,p.sourceLevel==='high'?1:0);
   assert.ok(!html.includes('|'));if(selected.displayedLabelText)assert.ok(html.includes(selected.displayedLabelText));
   const blinded=renderToStaticMarkup(React.createElement(PostAuthor,{post:{...p,...selected,displayName:'测试昵称'},compact:true,hideCertification:true}));
   assert.ok(!/feed-identities|高信源认证|ring-amber/.test(blinded));
  }
 }
 assert.match(q.QUESTIONNAIRES.fertility.scenario,/每月领 800 元/);assert.match(q.coreQuestion('ai').text,/误诊、漏诊/);
 assert.ok(!/2000|工作机会|就业|裁员/.test(JSON.stringify(q.QUESTIONNAIRES)));
});

test('旧材料进度拒绝静默升版，原始存储保持不变',()=>{
 const storage=new Map(),s=load('app/protocol/v5/lib/experimentSession.ts');
 const key=s.storageKey('test_old_material_draft'),raw=JSON.stringify({schemaVersion:5,uid:'test_old_material_draft',questionnaireVersion:'2026-11-24-v4',phase:'experiment'});
 const previous=global.localStorage;global.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
 try{storage.set(key,raw);assert.throws(()=>s.loadSession('test_old_material_draft'),/旧版实验材料/);assert.equal(storage.get(key),raw);}finally{global.localStorage=previous;}
});

test('双区布局与旧布局均可保存，双区帖子换半区或跨中线展开被拒绝',()=>{
 const f=blindFixture('fertility',24,'test_dual_zone_validation');
 assert.ok(v.validSubmission(f));
 f.readingMetrics.packingVersion='dual-zone-grid-v1';f.readingMetrics.columns=4;
 for(const [i,c] of f.readingMetrics.cards.entries()){
  c.column=i%4;c.columnSpan=1;
  for(const p of c.layouts){p.columns=4;p.column=c.column;p.columnSpan=1;}
 }
 assert.ok(v.validSubmission(f));
 const moved=structuredClone(f),c=moved.readingMetrics.cards[0];c.column=2;c.layouts.at(-1).column=2;
 assert.equal(v.validSubmission(moved),false);
 const crossing=structuredClone(f),d=crossing.readingMetrics.cards[1];d.columnSpan=2;d.layouts.at(-1).columnSpan=2;
 assert.equal(v.validSubmission(crossing),false);
 const invalid=structuredClone(f);invalid.readingMetrics.packingVersion='unknown';assert.equal(v.validSubmission(invalid),false);
});
