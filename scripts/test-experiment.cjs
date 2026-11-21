const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { createLoader, fixture, refreshRecognition, legacyFixture } = require("./test-support.cjs");
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
    for (const q of [...pre, ...post]) assert.equal(q.options.length, 5);
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
      assert.equal((html.match(/type="radio"/g) || []).length, 5);
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
    f => { f.comprehension[0].correct = true; }, f => { f.comprehension.pop(); },
    f => { f.comprehension[1].timestamp = f.startTime + 1; }, f => { f.startTime = NaN; },
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
  s.comprehension = f.comprehension;
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
      if (name === "submit_experiment_v3") completed = true;
      return { data: name === "submit_experiment_v3" ? "ABCDEF" : null, error: null };
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
  assert.equal(calls.at(-1).name, "submit_experiment_v3");
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
