const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { createLoader, fixture, refreshRecognition, legacyFixture, v2Fixture } = require("./test-support.cjs");
const load = createLoader();
const { getQuestions, QUESTIONNAIRES } = load("app/data/questionnaire.ts");
const { validSubmission, validPretest, canonicalJson } = load("app/lib/submissionValidation.ts");
const { createSession, saveSession, loadSession, remainingReadingMs, readingEndData, finalPayload } = load("app/lib/experimentSession.ts");

test("新前测5题、后测立场/把握/博物馆3题，博物馆无议题情境", () => {
  for (const topic of ["ai", "fertility"]) {
    const pre = getQuestions(topic, "pretest"), post = getQuestions(topic, "posttest");
    assert.equal(pre.length, 5); assert.equal(post.length, 3);
    assert.equal(post[0].statement, QUESTIONNAIRES[topic].statement);
    assert.equal(pre[3].id, "confidence"); assert.deepEqual(pre[4], post[2]);
    assert.equal(pre[4].context, "none");
    for (const q of [...pre, ...post]) assert.equal(q.options.length, q.context === "none" ? 3 : 5);
  }
});

test("问卷固定情境、没有预选，未选不能前进，后测不展示前测答案", () => {
  const { QuestionnairePage } = load("app/components/QuestionnairePage.tsx");
  for (const topic of ["ai", "fertility"]) for (const stage of ["pretest", "posttest"]) {
    const f = fixture(topic);
    for (let i = 0; i < getQuestions(topic, stage).length; i++) {
      const html = renderToStaticMarkup(React.createElement(QuestionnairePage, { topic, stage,
        response: { ...f[stage], answers: f[stage].answers.slice(0, i) }, onAnswer() {} }));
      assert.equal(html.includes(QUESTIONNAIRES[topic].scenario), stage === "pretest" && i < 4);
      assert.equal((html.match(/type="radio"/g) || []).length, getQuestions(topic,stage)[i].options.length);
      assert.ok(!html.includes("checked="));
      assert.match(html, /<button[^>]*disabled/);
      assert.ok(!html.includes("情境说明"));
      assert.ok(!html.includes("没有标准答案"));
      assert.ok(!html.includes("你的答案可以与之前相同"));

    }
  }
});

test("六种条件有效，前测可独立保存；0/1次转发都能超时完成", () => {
  for (const topic of ["ai", "fertility"]) for (const n of [8, 16, 48]) {
    const f = fixture(topic, n);
    assert.ok(validPretest(f)); assert.ok(validSubmission(f));
    const post = load("app/lib/materialsRegistry.ts").getMaterialsForTopic(topic).materials;
    const p = Object.values(post).flat().find(p => p.id === f.postOrder[0]);
    f.actions = [{ type: "share", postId: p.id, timestamp: f.startTime + 20, order: 1,
      stance: p.stance, sourceLevel: p.sourceLevel, quality: p.quality }];
    refreshRecognition(f); assert.ok(validSubmission(f));
    f.endReason = "manual";
    assert.equal(validSubmission(f), false);
    const p2 = Object.values(post).flat().find(p => p.id === f.postOrder[1]);
    f.actions.push({ type: "share", postId: p2.id, timestamp: f.startTime + 30, order: 2,
      stance: p2.stance, sourceLevel: p2.sourceLevel, quality: p2.quality });
    refreshRecognition(f); assert.ok(validSubmission(f));
  }
});

test("拒绝非法答案、阶段时间、理解题、材料、转发、行为和曝光记录", () => {
  const mutations = [
    f => { f.pretest.answers[0].value = 0; }, f => { f.posttest.answers[0].value = 6; },
    f => { f.posttest.answers[0].value = 1.5; }, f => { f.pretest.answers[0].value = "3"; },
    f => { f.pretest.answers.pop(); }, f => { f.posttest.answers.reverse(); },
    f => { f.questionnaireVersion = "old"; }, f => { f.topicKey = "eldercare"; },
    f => { f.pretest.completedAt = f.startTime + 1; }, f => { f.posttest.startedAt = f.endTime - 1; },
    f => { f.comprehension[0].correct = false; }, f => { f.comprehension.pop(); },
    f => { f.comprehension[0].timestamp = f.startTime + 1; }, f => { f.startTime = NaN; },
    f => { f.postOrder[0] = f.postOrder[1]; }, f => { f.postOrder[0] = "fake"; },
    f => { f.actions = [{ type: "like", postId: f.postOrder[0], timestamp: f.endTime + 1 }]; },
    f => { f.actions = [{ type: "user_post", timestamp: f.startTime + 1, content: "a".repeat(101), charCount: 101 }]; },
    f => { f.scrollEvents = [{ postId: "fake", action: "enter_viewport", timestamp: f.startTime + 1, scrollY: 0 }]; },
    f => { f.postVisibilitySummary[f.postOrder[0]].totalVisibleMs = 90001; },
    f => { f.postVisibilitySummary[f.postOrder[0]].firstSeenAt = f.endTime + 1; },
    f => { f.endTime += 1; }, f => { f.sessionId = "invalid"; },
  ];
  for (const mutate of mutations) { const f = fixture(); mutate(f); assert.equal(validSubmission(f), false, mutate.toString()); }
  for (const v of [null, {}, [], "bad", 1]) assert.equal(validSubmission(v), false);
});

test("本地恢复保留条件、材料、人设、截止时间和行为；过期不重置90秒", () => {
  const memory = new Map();
  Object.defineProperty(global, "localStorage", { configurable: true, value: {
    getItem: k => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v),
  } });
  const s = createSession({ uid: "qa_recovery", conditionN: 48, topic: "ai", returnUrl: null });
  const f = fixture("ai", 48, s.uid);
  s.phase = "experiment";
  s.pretest = f.pretest;
  s.comprehension = f.comprehension; s.rules = f.rules; s.microphonePermission=f.microphonePermission;
  s.reading = { posts: f.postOrder.map(id => ({ id, content: "已保存的原始正文", displayName: `saved_${id}` })),
    startTime: f.startTime, deadline: f.endTime, savedAt: f.startTime + 100, actions: f.actions,
    scrollEvents: [], postVisibilitySummary: f.postVisibilitySummary, maxScrollY: 42, scrollY: 42,
    userPostDraft: "草稿", ownPost: null, insertBeforePostId: null };
  saveSession(s);
  const restored = loadSession(s.uid);
  assert.deepEqual(restored, s);
  assert.equal(remainingReadingMs(restored.reading, f.startTime + 20000), 70000);
  assert.equal(remainingReadingMs(restored.reading, f.endTime + 10000), 0);
  const end = readingEndData(restored, restored.reading, f.endTime + 10000, "timeout", f.topic);
  assert.equal(end.endTime, f.endTime); assert.deepEqual(end.postOrder, f.postOrder);
  restored.endData = end; restored.posttest = f.posttest; restored.recognition = f.recognition; restored.explanation = f.explanation; restored.reasons = f.reasons;
  const payload = finalPayload(restored);
  assert.deepEqual(payload.pretest.answers, f.pretest.answers);
  assert.equal(payload.sessionId, s.sessionId);
  const key = load("app/lib/experimentSession.ts").storageKey(s.uid);
  memory.set(key, "{bad json"); assert.throws(() => loadSession(s.uid), /已保存的进度/);
  memory.set(key, JSON.stringify({ ...s, reading: { ...s.reading, deadline: s.reading.deadline + 100 } }));
  assert.throws(() => loadSession(s.uid), /已保存的进度/);
});

test("请求摘要不受对象键顺序影响，答案变化会改变摘要", () => {
  const f = fixture(); const reversed = Object.fromEntries(Object.entries(f).reverse());
  assert.equal(canonicalJson(f), canonicalJson(reversed));
  reversed.posttest = structuredClone(f.posttest); reversed.posttest.answers[0].value = 5;
  assert.notEqual(canonicalJson(f), canonicalJson(reversed));
});

test("API校验及完成状态：前测不创建完成记录，失败可重试，响应禁止缓存", async () => {
  const calls = []; let completed = false; let fail = false;
  const mockedLoad = createLoader({ "supabaseAdmin.ts": { getSupabaseAdmin: () => ({
    rpc: async (name, params) => {
      calls.push({ name, params });
      if (fail) return { data: null, error: { code: "XX000" } };
      if (name === "submit_experiment_v4") completed = true;
      return { data: name === "submit_experiment_v4" ? "ABCDEF" : null, error: null };
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: completed ? { uid: "qa" } : null, error: null }) }) }) }),
  }) } });
  const progress = mockedLoad("app/api/progress/route.ts");
  const submit = mockedLoad("app/api/submit/route.ts");
  const status = mockedLoad("app/api/status/route.ts");
  const request = body => new Request("http://localhost/api", { method: "POST", body: JSON.stringify(body) });
  const f = fixture();
  assert.equal((await progress.POST(request({}))).status, 400); assert.equal(calls.length, 0);
  assert.equal((await progress.POST(request(f))).status, 200);
  let result = await status.GET(new Request("http://localhost/api/status?uid=qa"));
  assert.deepEqual(await result.json(), { completed: false }); assert.match(result.headers.get("cache-control"), /no-store/);
  fail = true; assert.equal((await submit.POST(request(f))).status, 500);
  fail = false; result = await submit.POST(request(f));
  assert.deepEqual(await result.json(), { completionCode: "ABCDEF" });
  assert.equal(calls.at(-1).name, "submit_experiment_v4");
  assert.equal((await status.GET(new Request("http://localhost/api/status"))).status, 400);
  assert.deepEqual(await (await status.GET(new Request("http://localhost/api/status?uid=qa"))).json(), { completed: true });
});


test("再认仅一个已转发目标、三个实际展示未转发片段，记不清也可继续", () => {
  for (let count = 0; count <= 2; count++) {
    const f = fixture();
    const materials = Object.values(load("app/lib/materialsRegistry.ts").getMaterialsForTopic(f.topicKey).materials).flat();
    f.actions = f.postOrder.slice(0, count).map((id, i) => {
      const p = materials.find(p => p.id === id);
      return { type: "share", postId: id, timestamp: f.startTime + i + 1, order: i + 1, stance: p.stance, sourceLevel: p.sourceLevel, quality: p.quality };
    });
    refreshRecognition(f); assert.ok(validSubmission(f));
    if (!count) { assert.equal(f.recognition.skipReason, "no_shares"); continue; }
    assert.equal(f.recognition.options.filter(o => f.actions.some(a => a.postId === o.postId)).length, 1);
    assert.equal(f.recognition.options.length, 4);
    const { answerRecognition } = load("app/lib/posttest.ts");
    f.recognition = answerRecognition(f.recognition, "not_sure", f.endTime + 70);
    assert.ok(validSubmission(f)); assert.equal(f.recognition.correct, false);
    f.recognition.options[0].excerpt += "篡改"; assert.equal(validSubmission(f), false);
  }
});

test("解释门槛按Unicode字母数字计算，20秒或20字独立满足；原因最多3项且感觉互斥", () => {
  const { countEffectiveCharacters, explanationQualifies, toggleReason } = load("app/lib/posttest.ts");
  assert.equal(countEffectiveCharacters("中 A２9。！  😀\n"), 4);
  const e = { text: "a".repeat(10), audio: { state: "ready", durationMs: 10000 } };
  assert.equal(explanationQualifies(e), false); e.audio.durationMs = 20000; assert.equal(explanationQualifies(e), true);
  e.audio.durationMs = 0; e.text = "a".repeat(20); assert.equal(explanationQualifies(e), true);
  assert.deepEqual(toggleReason(["a","b","c"], "d"), ["a","b","c"]);
  assert.deepEqual(toggleReason(["a","b"], "feeling"), ["feeling"]);
  assert.deepEqual(toggleReason(["feeling"], "a"), ["a"]);
  for (const mutation of [
    f => f.explanation.effectiveCharCount++, f => f.explanation.text = "！".repeat(20),
    f => f.reasons.selected = ["feeling", f.reasons.order[0]], f => f.reasons.primary = "fake",
    f => f.reasons.order.reverse(), f => f.reasons.completedAt = f.posttest.answers[2].startedAt + 1,
    f => f.explanation.audio = "bad", f => f.recognition = null,
  ]) { const f = fixture(); mutation(f); assert.equal(validSubmission(f), false); }
});

test("旧版会话使用独立题目及校验，不会静默转换新后测", () => {
  const f = legacyFixture(); assert.ok(load("app/legacy/submissionValidation.ts").validSubmission(f));
  assert.equal(validSubmission(f), false);
});

test('再认和原因随机顺序刷新不重抽，旧存储单独恢复',()=>{
  const memory=new Map();Object.defineProperty(global,'localStorage',{configurable:true,value:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)}});
  const s=createSession({uid:'qa_new_recovery',conditionN:8,topic:'ai',returnUrl:null});const f=fixture('ai',8,s.uid);
  s.phase='recognition';s.pretest=f.pretest;s.comprehension=f.comprehension;s.endData={...f};s.recognition=f.recognition;s.reasons=f.reasons;
  saveSession(s);assert.deepEqual(loadSession(s.uid).recognition,s.recognition);assert.deepEqual(loadSession(s.uid).reasons.order,s.reasons.order);
  memory.set('labweb:session:v1:old_uid','{}');assert.throws(()=>loadSession('old_uid'),load('app/lib/experimentSession.ts').LegacySessionError);
});

test('录音时长明确表示下限，完成规则显示在录音框外',()=>{
 const {VoiceRecorder}=load('app/components/VoiceRecorder.tsx');
 const {ExplanationPage}=load('app/components/ExplanationPage.tsx');
 const f=fixture();const audio={recordingId:crypto.randomUUID(),state:'ready',durationMs:22000,mimeType:'audio/mp4',byteLength:100,sha256:'a'.repeat(64),storagePath:null,recordedAt:f.explanation.startedAt,finishedAt:f.explanation.startedAt+22000};
 const recorder=renderToStaticMarkup(React.createElement(VoiceRecorder,{audio,disabled:false,onChange(){},onBusyChange(){}}));
 assert.ok(recorder.includes('已录音22秒，已达到最低时长'));assert.ok(!recorder.includes('/ 20 秒'));assert.ok(!recorder.includes('任选一种'));
 const html=renderToStaticMarkup(React.createElement(ExplanationPage,{topic:'ai',identity:f,response:{...f.explanation,audio},onChange(){},onContinue(){return true;}}));
 assert.ok(html.indexOf('任选一种即可')<html.indexOf('aria-label="录音解释"'));
});

test('首句预览按终止标点与20个可见字符取短，不拼接后句',()=>{
 const {previewText}=load('app/lib/readingProtocol.ts');
 for(const [source,expected,truncated] of [
  ['我先说一句：这件事要看具体情况。','我先说一句',false],
  ['补贴真的会有用吗？我觉得还得讨论。','补贴真的会有用吗',false],
  ['我不太认同；理由是后面这些。','我不太认同',false],
  ['  短句。后面不能拼进来','短句',false],
  ['一'.repeat(20)+'。后文','一'.repeat(20),false],
  ['一'.repeat(21)+'。后文','一'.repeat(20)+'…',true],
  ['第一行\n第二行','第一行',false],
  ['。异常开头不跳到后句','',false],
  ['👨‍👩‍👧‍👦'.repeat(21),'👨‍👩‍👧‍👦'.repeat(20)+'…',true],
 ]) {const p=previewText(source);assert.equal(p.text,expected);assert.equal(p.lengthTruncated,truncated);}
});

test('浏览覆盖需50%可见持续250ms；详情暂停背景曝光，刷新不计离开间隙',()=>{
 const {ReadingTracker}=load('app/lib/readingProtocol.ts');const f=fixture();
 const materials=Object.values(load('app/lib/materialsRegistry.ts').getMaterialsForTopic('ai').materials).flat();
 const posts=f.presentedPosts.map(p=>({...materials.find(m=>m.id===p.postId),displayName:p.displayName}));
 const t=new ReadingTracker(posts),a=posts[0].id,b=posts[1].id,start=f.startTime;
 t.setVisible(a,true,start,0);assert.equal(t.snapshot(start+249,0,[]).metrics.viewedPostIds.length,0);
 t.setVisible(b,true,start+100,0);t.open(a,start+300,0);
 let snap=t.snapshot(start+1000,0,[]);assert.deepEqual(snap.metrics.viewedPostIds,[a]);assert.equal(snap.visibility[a].totalVisibleMs,300);assert.equal(snap.visibility[b].totalVisibleMs,200);
 assert.deepEqual(t.context(a,'detail'),{surface:'detail',detailOpenedBefore:true});assert.deepEqual(t.context(b,'preview'),{surface:'preview',detailOpenedBefore:false});
 const restored=new ReadingTracker(posts,{metrics:snap.metrics,scrollEvents:snap.events,postVisibilitySummary:snap.visibility});
 restored.resumeDetail(start+5000);restored.close(start+5300);snap=restored.snapshot(start+5400,0,[]);
 assert.equal(snap.metrics.detailEvents.filter(e=>e.type==='open').length,1);assert.equal(snap.metrics.detailIntervals.reduce((sum,i)=>sum+i.endedAt-i.startedAt,0),1000);
 assert.equal(snap.visibility[a].totalVisibleMs,300);
 restored.open(a,start+5500,0);assert.equal(restored.visits(a),2);
});

test('错答经5秒真实显示纠正后可进入，三档博物馆不接受旧五档值',()=>{
 const f=fixture();f.comprehension=[{value:2,correct:false,timestamp:f.pretest.completedAt+100,feedbackPresentedAt:f.pretest.completedAt+101,feedbackVisibleMs:5000,autoAdvancedAt:f.pretest.completedAt+5101}];
 assert.ok(validSubmission(f));f.comprehension[0].feedbackVisibleMs=4999;assert.equal(validSubmission(f),false);
 const g=fixture();g.pretest.answers.at(-1).value=4;assert.equal(validSubmission(g),false);
 const v2=v2Fixture();assert.ok(load('app/compat/v2/lib/submissionValidation.ts').validSubmission(v2));assert.equal(validSubmission(v2),false);
});

test('统一解释提交保留已生成的短录音；非法预览、操作来源、规则与未核实曝光被拒绝',()=>{
 const {validExplanation}=load('app/lib/posttestValidation.ts');const f=fixture();const e={...f.explanation,audio:{recordingId:crypto.randomUUID(),mimeType:'audio/mp4',durationMs:10000,byteLength:100,sha256:'a'.repeat(64),state:'uploaded',storagePath:null,recordedAt:f.explanation.startedAt,finishedAt:f.explanation.startedAt+10000},inputMethod:'both',completedAt:f.explanation.startedAt+10001};e.audio.storagePath=`${f.sessionId}/${e.audio.recordingId}.m4a`;
 assert.ok(validExplanation(e,f.sessionId));e.audio.state='excluded';assert.equal(validExplanation(e,f.sessionId),false);
 for(const mutate of [g=>g.readingMetrics.cards[0].preview.text='改写',g=>g.readingMetrics.cards[0].column=1,g=>g.readingMetrics.viewedPostIds=[g.postOrder[0]],g=>g.rules.items[0].checked=false,g=>g.readingMetrics.taskGoal.achieved=true]){const g=fixture();mutate(g);assert.equal(validSubmission(g),false);}
 const {ExplanationPage}=load('app/components/ExplanationPage.tsx');const html=renderToStaticMarkup(React.createElement(ExplanationPage,{topic:'ai',identity:f,response:f.explanation,onChange(){},onContinue(){return true;}}));assert.ok(html.includes('>提交</button>'));assert.ok(!html.includes('仅使用文字继续'));assert.ok(!html.includes('>下一步</button>'));
});

test('瀑布流按当前最短列放置，只有首排对齐，不重排随机材料序列',()=>{
 const {assignMasonryColumns}=load('app/lib/readingProtocol.ts');
 assert.deepEqual(assignMasonryColumns([240,150,120,200,90,80],2,10),[0,1,1,0,1,1]);
 assert.deepEqual(assignMasonryColumns([240,150,120,200,90],3,10),[0,1,2,2,1]);
});

test('页内展开只暂停该帖预览，其他可见卡片继续计时；全文离开视野不累计',()=>{
 const {ReadingTracker}=load('app/lib/readingProtocol.ts'),f=fixture();
 const all=Object.values(load('app/lib/materialsRegistry.ts').getMaterialsForTopic('ai').materials).flat(),posts=f.presentedPosts.map(p=>({...all.find(m=>m.id===p.postId),displayName:p.displayName}));
 const t=new ReadingTracker(posts),[a,b]=posts.map(p=>p.id),start=f.startTime;
 t.setVisible(a,true,start,0);t.setVisible(b,true,start,0);t.open(a,start+300,0,true);
 assert.equal(t.snapshot(start+500,0,[]).metrics.detailIntervals.length,0);
 t.resumeDetail(start+500);t.stopDetail(start+900);
 let s=t.snapshot(start+1500,0,[]);assert.equal(s.visibility[a].totalVisibleMs,300);assert.equal(s.visibility[b].totalVisibleMs,1500);assert.equal(s.metrics.detailIntervals[0].endedAt-s.metrics.detailIntervals[0].startedAt,400);
 t.resumeDetail(start+1600);t.close(start+1800);s=t.snapshot(start+2000,0,[]);assert.equal(s.metrics.detailIntervals.reduce((n,v)=>n+v.endedAt-v.startedAt,0),600);assert.deepEqual(t.context(a,'preview'),{surface:'preview',detailOpenedBefore:true});
});

test('页内版本接受30秒五闪，旧详情版本继续按两闪校验',()=>{
 const p=load('app/lib/readingProtocol.ts'),f=fixture();
 f.readingMetrics.alerts=[{kind:'thirty_seconds',shownAt:f.endTime-29000,reason:'threshold',flashes:5,completedAt:f.endTime-25000}];assert.ok(validSubmission(f));
 f.readingMetrics.alerts[0].flashes=6;assert.equal(validSubmission(f),false);
 f.readingMetrics.version=p.PANEL_READING_UI_VERSION;f.readingMetrics.alerts[0].flashes=2;assert.ok(validSubmission(f));f.readingMetrics.alerts[0].flashes=5;assert.equal(validSubmission(f),false);
});

test('手机展开独占一行、后续顺延；矩形回填不重叠、不越界',()=>{
 const {placeSpanningCards}=load('app/lib/spanningMasonry.ts');
 const first=placeSpanningCards([100,100,100,100],[100,250,100,100],[false,true,false,false],2,10);assert.equal(first[1].column,0);assert.equal(first[1].span,2);assert.equal(first[1].top,110);assert.equal(first[0].top,0);assert.ok(first[2].top>=370);
 for(const columns of [2,3,4]){const collapsed=Array.from({length:48},(_,i)=>100+i%7*15),expanded=collapsed.map((_,i)=>i%5===1),heights=collapsed.map((h,i)=>expanded[i]?h*2:h),boxes=placeSpanningCards(collapsed,heights,expanded,columns,12);
  assert.equal(boxes.length,48);for(let i=0;i<48;i++){const a=boxes[i];assert.equal(a.span,expanded[i]?2:1);assert.ok(a.column>=0&&a.column+a.span<=columns);for(let j=0;j<i;j++){const b=boxes[j];assert.ok(!(a.column<b.column+b.span&&a.column+a.span>b.column&&a.top<b.top+b.height&&a.top+a.height>b.top));}}
 }
});

test('多张全文独立保持展开、分别计时和收起；并行可见区间可正常保存',()=>{
 const {ReadingTracker,SINGLE_INLINE_READING_UI_VERSION}=load('app/lib/readingProtocol.ts'),f=fixture(),all=Object.values(load('app/lib/materialsRegistry.ts').getMaterialsForTopic('ai').materials).flat(),posts=f.presentedPosts.map(p=>({...all.find(m=>m.id===p.postId),displayName:p.displayName})),t=new ReadingTracker(posts),[a,b]=posts.map(p=>p.id),start=f.startTime;
 t.open(a,start+100,0,true);t.resumeDetail(start+200,a);t.open(b,start+300,0,true);t.resumeDetail(start+400,b);assert.deepEqual(t.metrics.openDetailIds,[a,b]);t.close(start+600,a);assert.deepEqual(t.metrics.openDetailIds,[b]);const partial=t.snapshot(start+900,0,[]);assert.equal(partial.metrics.detailIntervals.find(v=>v.postId===b).endedAt,start+900);t.close(start+1000,b);const done=t.snapshot(start+1100,0,[]);assert.deepEqual(done.metrics.openDetailIds,[]);assert.equal(done.metrics.detailIntervals.filter(v=>v.postId===a).reduce((n,v)=>n+v.endedAt-v.startedAt,0),400);assert.equal(done.metrics.detailIntervals.filter(v=>v.postId===b).reduce((n,v)=>n+v.endedAt-v.startedAt,0),600);
 done.metrics.cards=f.readingMetrics.cards;f.readingMetrics=done.metrics;assert.ok(validSubmission(f));f.readingMetrics.version=SINGLE_INLINE_READING_UI_VERSION;assert.equal(validSubmission(f),false);
});

test('两类标签按50%边界选一种，单类直接显示，低信源不抽签且无标签',()=>{
 const {chooseDisplayedLabel}=load('app/lib/labelSelection.ts'),both={sourceLevel:'high',identityLabel:'身份',platformLabel:'平台'};
 assert.equal(chooseDisplayedLabel(both,()=>.499999).displayedLabelType,'identity');assert.equal(chooseDisplayedLabel(both,()=>.5).displayedLabelType,'platform');
 let calls=0;const rng=()=>{calls++;return .1;};assert.equal(chooseDisplayedLabel({...both,platformLabel:null},rng).displayedLabelText,'身份');assert.equal(chooseDisplayedLabel({...both,identityLabel:null},rng).displayedLabelText,'平台');const low=chooseDisplayedLabel({...both,sourceLevel:'low'},rng);assert.equal(low.displayedLabelType,null);assert.equal(low.displayedLabelText,null);assert.equal(calls,0);
});

test('新会话保存真实选中标签，恢复和渲染不再抽签；教程选择随规则保存',()=>{
 const f=fixture('ai',48),protocol=load('app/lib/readingProtocol.ts'),selection=load('app/lib/labelSelection.ts'),{PostAuthor}=load('app/components/CompactPostCard.tsx'),materials=Object.values(load('app/lib/materialsRegistry.ts').getMaterialsForTopic('ai').materials).flat();
 const s=createSession({uid:'qa_label_restore',conditionN:48,topic:'ai',returnUrl:null});Object.assign(s,{phase:'experiment',pretest:f.pretest,comprehension:f.comprehension,rules:f.rules,microphonePermission:f.microphonePermission});const posts=f.presentedPosts.map(p=>({...materials.find(m=>m.id===p.postId),...p,id:p.postId}));s.reading={posts,startTime:f.startTime,deadline:f.endTime,savedAt:f.startTime,metrics:f.readingMetrics,actions:[],scrollEvents:[],postVisibilitySummary:f.postVisibilitySummary,maxScrollY:0,scrollY:0,userPostDraft:'',ownPost:null,insertBeforePostId:null};saveSession(s);
 const random=Math.random;Math.random=()=>{throw Error('Unexpected redraw');};try{const restored=loadSession(s.uid);assert.deepEqual(restored.reading.posts,s.reading.posts);assert.deepEqual(restored.rules.demoLabelSelections,s.rules.demoLabelSelections);assert.deepEqual(protocol.newRules(Date.now(),s.rules.demoLabelSelections).demoLabelSelections,s.rules.demoLabelSelections);const high=posts.find(p=>p.sourceLevel==='high'&&p.identityLabel&&p.platformLabel);const html=renderToStaticMarkup(React.createElement(PostAuthor,{post:high,compact:true}));assert.ok(html.includes(high.displayedLabelText));const notShown=high.displayedLabelType==='identity'?high.platformLabel:high.identityLabel;assert.ok(!html.includes(notShown));}finally{Math.random=random;}
 const end=readingEndData(s,s.reading,f.endTime,'timeout',f.topic);for(const p of end.presentedPosts){assert.ok(selection.validDisplayedLabel(posts.find(x=>x.id===p.postId),p));}assert.equal(end.readingMetrics.labelSelectionVersion,selection.LABEL_SELECTION_VERSION);
});

test('选中标签不可篡改或漏存，更新短标签不阻断旧标签记录提交',()=>{
 const f=fixture('ai',48),high=f.presentedPosts.find(p=>p.identityLabel&&p.platformLabel);assert.ok(validSubmission(f));const text=high.displayedLabelText;high.displayedLabelText='伪造标签';assert.equal(validSubmission(f),false);high.displayedLabelText=text;delete high.labelSelectionVersion;assert.equal(validSubmission(f),false);
 const priorTutorial=fixture();delete priorTutorial.rules.demoLabelSelections;delete priorTutorial.rules.demoLabelSelectionVersion;assert.ok(validSubmission(priorTutorial));const missingDemo=fixture();delete missingDemo.rules.demoLabelSelections;assert.equal(validSubmission(missingDemo),false);
 const history=load('app/data/materials/labels-before-20261122.json');for(const make of [()=>fixture('ai',48),v2Fixture]){const old=make();if(old.readingMetrics)delete old.readingMetrics.labelSelectionVersion;for(const p of old.presentedPosts){if(history[old.topicKey][p.postId])Object.assign(p,history[old.topicKey][p.postId]);for(const k of ['labelSelectionVersion','displayedLabelType','displayedLabelText'])delete p[k];}const validate=old.questionnaireVersion==='2026-11-21-v2'?load('app/compat/v2/lib/submissionValidation.ts').validSubmission:validSubmission;assert.ok(validate(old));}
});


test('桌面后续短卡回填宽卡上方的有限空洞，等高位置优先靠近原列',()=>{
 const {placeSpanningCards}=load('app/lib/spanningMasonry.ts');
 const boxes=placeSpanningCards([100,300,100,80],[100,300,200,80],[false,false,true,false],3,10);
 assert.equal(boxes[2].top,310);assert.equal(boxes[2].span,2);assert.equal(boxes[3].column,2);assert.equal(boxes[3].top,0);assert.ok(boxes[3].top+boxes[3].height<boxes[2].top);
 const near=placeSpanningCards([100,100],[100,100],[false,false],4,10,[{column:3,span:1,top:0,height:100},{column:2,span:1,top:0,height:100}]);assert.equal(near[0].column,3);assert.equal(near[1].column,2);
});
