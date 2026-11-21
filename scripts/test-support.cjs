const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");

function createLoader(mocks = {}) {
  const cache = new Map();
  function load(input) {
    let file = path.resolve(root, input);
    if (!path.extname(file)) file += fs.existsSync(`${file}.ts`) ? ".ts" : ".tsx";
    if (file.endsWith(".json")) return JSON.parse(fs.readFileSync(file, "utf8"));
    for (const [suffix, mock] of Object.entries(mocks)) if (file.endsWith(suffix)) return mock;
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText;
    const localRequire = name => name.startsWith(".") ? load(path.resolve(path.dirname(file), name)) : require(name);
    new vm.Script(`(function(require,module,exports){${compiled}\n})`, { filename: file }).runInThisContext()(localRequire, module, module.exports);
    return module.exports;
  }
  return load;
}

function fixture(topicKey = "ai", conditionN = 8, uid = `qa_unit_${topicKey}_${conditionN}`) {
  const load = createLoader();
  const { getQuestions, QUESTIONNAIRE_VERSION } = load("app/data/questionnaire.ts");
  const { getMaterialsForTopic } = load("app/lib/materialsRegistry.ts");
  const { blockRandomize } = load("app/lib/blockRandomize.ts");
  const { enrichPostsForDisplay } = load("app/lib/enrichPosts.ts");
  const { newExplanation, newReasons } = load("app/lib/posttest.ts");
  const base = 1795248000000;
  const response = (stage, startedAt) => ({ stage, startedAt, completedAt: startedAt + (stage === "pretest" ? 100 : 700),
    answers: getQuestions(topicKey, stage).map((q, i) => ({ questionId: q.id, value: i % q.options.length + 1,
      startedAt: startedAt + (stage === "posttest" && i === 2 ? 600 : i * 10),
      answeredAt: startedAt + (stage === "posttest" && i === 2 ? 605 : i * 10 + 5) })) });
  const posts = enrichPostsForDisplay(blockRandomize(getMaterialsForTopic(topicKey).materials, conditionN), topicKey);
  const postStart = base + 100200;
  const reasons = newReasons(topicKey, postStart + 500);
  reasons.selected = [reasons.order[0]]; reasons.primary = reasons.order[0]; reasons.selectedAt = postStart + 510; reasons.completedAt = postStart + 520;
  const f = { uid, sessionId: crypto.randomUUID(), sessionSecret: crypto.randomBytes ? crypto.randomBytes(32).toString("hex") : require("node:crypto").randomBytes(32).toString("hex"), questionnaireVersion: QUESTIONNAIRE_VERSION,
    conditionN, topicKey, topic: getMaterialsForTopic(topicKey).topic, pretest: response("pretest", base),
    comprehension: [{ value: 1, correct: true, timestamp: base + 200, feedbackPresentedAt:base+201, feedbackVisibleMs:3000, autoAdvancedAt:base+3201 }],
    startTime: base + 10000, endTime: base + 100000, endReason: "timeout", maxScrollY: 0,
    postOrder: posts.map(p => p.id), actions: [], scrollEvents: [],
    presentedPosts: posts.map(p => ({ postId: p.id, displayName: p.displayName, avatarFile: p.avatarFile ?? null, identityLabel: p.identityLabel ?? null, platformLabel: p.platformLabel ?? null })),
    postVisibilitySummary: Object.fromEntries(posts.map(p => [p.id, { totalVisibleMs: 0, firstSeenAt: null }])),
    posttest: response("posttest", postStart),
    explanation: { ...newExplanation(postStart + 300), completedAt: postStart + 400, text: "我认为技术会改变现有岗位同时创造一些新的就业机会", effectiveCharCount: 25, inputMethod: "text" },
    reasons, interruptions: [] };
  f.explanation.effectiveCharCount = load("app/lib/posttest.ts").countEffectiveCharacters(f.explanation.text);
  const protocol = load("app/lib/readingProtocol.ts");
  f.rules = protocol.newRules(base+120);f.rules.completedAt=base+180;f.rules.items=f.rules.items.map((v,i)=>({...v,checked:true,changedAt:base+121+i}));
  f.microphonePermission={state:"denied",requestedAt:base-10,completedAt:base-5};
  f.readingMetrics=protocol.newReadingMetrics(posts);
  f.readingMetrics.cards.forEach((c,i)=>c.layouts.push({column:c.column,columns:2,timestamp:f.startTime,left:i%2*188,top:Math.floor(i/2)*210,width:178,height:200,viewportWidth:375,viewportHeight:667}));
  refreshRecognition(f);
  return f;
}
function refreshRecognition(f) {
  if(f.readingMetrics){const shares=f.actions.filter(a=>a.type==="share").length;f.readingMetrics.taskGoal={requiredShares:2,actualShares:shares,achieved:shares===2};f.actions.forEach(a=>{if(a.type!=="user_post"&&!a.interaction)a.interaction={surface:"preview",detailOpenedBefore:false};});}
  const load = createLoader();
  const materials = Object.values(load("app/lib/materialsRegistry.ts").getMaterialsForTopic(f.topicKey).materials).flat();
  const posts = f.presentedPosts.map(p => ({ ...materials.find(m => m.id === p.postId), ...p }));
  const { createRecognition, answerRecognition } = load("app/lib/posttest.ts");
  let r = createRecognition(posts, f.actions, f.endTime + 50);
  if (r.status === "pending") r = answerRecognition({ ...r, presentedAt: f.endTime + 60 }, r.targetPostId, f.endTime + 70);
  f.recognition = r;
}
function legacyFixture() {
  const f = fixture(); const load = createLoader();
  const { getQuestions, QUESTIONNAIRE_VERSION } = load("app/legacy/questionnaire.ts");
  f.questionnaireVersion = QUESTIONNAIRE_VERSION;
  for (const stage of ["pretest", "posttest"]) f[stage].answers = getQuestions(f.topicKey, stage).map((q, i) => ({questionId:q.id,value:3,startedAt:f[stage].startedAt+i*10,answeredAt:f[stage].startedAt+i*10+5}));
  f.comprehension=[{value:1,correct:false,timestamp:f.pretest.completedAt+100},{value:2,correct:true,timestamp:f.pretest.completedAt+200}];
  for (const key of ["rules","microphonePermission","readingMetrics","sessionSecret", "recognition", "explanation", "reasons", "presentedPosts", "interruptions"]) delete f[key];
  return f;
}
function v2Fixture() {
 const f=fixture();const load=createLoader();const {getQuestions,QUESTIONNAIRE_VERSION}=load("app/compat/v2/data/questionnaire.ts");f.questionnaireVersion=QUESTIONNAIRE_VERSION;
 for(const stage of ["pretest","posttest"])f[stage].answers=getQuestions(f.topicKey,stage).map((q,i)=>({questionId:q.id,value:3,startedAt:f[stage].startedAt+(stage==="posttest"&&i===2?600:i*10),answeredAt:f[stage].startedAt+(stage==="posttest"&&i===2?605:i*10+5)}));
 f.comprehension=[{value:2,correct:true,timestamp:f.pretest.completedAt+100}];
 for(const key of ["rules","microphonePermission","readingMetrics"])delete f[key];return f;
}
module.exports = { root, createLoader, fixture, refreshRecognition, legacyFixture, v2Fixture };
