// 运行前启动 qa-server.cjs 和连接该隔离库的 Next.js 预览（端口3210）。
const test = require("node:test");
const assert = require("node:assert/strict");
const { fixture } = require("./test-support.cjs");
const app = "http://127.0.0.1:3210";
const db = "http://127.0.0.1:3211";
const post = (route, body) => fetch(`${app}${route}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const status = async uid => (await fetch(`${app}/api/status?uid=${encodeURIComponent(uid)}`)).json();
const state = async uid => (await fetch(`${db}/_qa/state?uid=${encodeURIComponent(uid)}`)).json();

test("实际HTTP接口：六种条件前测保存、后测完成及四表关联", async () => {
  for (const topic of ["ai", "fertility"]) for (const n of [8, 16, 48]) {
    const f = fixture(topic, n, `qa_http_${topic}_${n}_${Date.now()}`);
    assert.equal((await post("/api/progress", f)).status, 200);
    assert.deepEqual(await status(f.uid), { completed: false });
    assert.equal((await post("/api/explanation",{...f,explanation:f.explanation})).status,200);
    const result = await post("/api/submit", f); assert.equal(result.status, 200, await result.clone().text());
    assert.match((await result.json()).completionCode, /^[A-Z2-9]{6}$/);
    assert.deepEqual(await status(f.uid), { completed: true });
    const saved = await state(f.uid);
    assert.equal(saved.counts.post_visibility, n);
    assert.deepEqual(saved.session.posttest, f.posttest);
    assert.equal(saved.experiment.topic_key, topic);
  }
});

test("实际HTTP接口：数据库成功后响应丢失，原载荷重试恢复且不重复入库", async () => {
  const f = fixture("ai", 8, `qa_http_retry_${Date.now()}`);
  await fetch(`${db}/_qa/fail-next?phase=save_experiment_pretest_v4`);
  assert.equal((await post("/api/progress", f)).status, 500);
  assert.deepEqual(await status(f.uid), { completed: false });
  assert.equal((await post("/api/progress", f)).status, 200);
  assert.equal((await post("/api/explanation",{...f,explanation:f.explanation})).status,200);
  await fetch(`${db}/_qa/fail-next?phase=submit_experiment_v4`);
  assert.equal((await post("/api/submit", f)).status, 500);
  assert.deepEqual(await status(f.uid), { completed: true });
  const before = await state(f.uid);
  const retry = await post("/api/submit", f); assert.equal(retry.status, 200);
  assert.equal((await retry.json()).completionCode, before.experiment.completion_code);
  assert.deepEqual((await state(f.uid)).counts, before.counts);
});

test('实际HTTP音频：失败保留、重试校验、私有文件、不可覆盖、必需上传阻止完成',async()=>{
  const {createHash}=require('node:crypto');
  const f=fixture('ai',8,`qa_audio_http_${Date.now()}`);
  // 容器签名模拟只用于接口完整性校验，真实编码器另在Safari验证。
  const bytes=Buffer.concat([Buffer.from('1a45dfa3','hex'),Buffer.from('local-qa-container-fixture')]);
  const a={recordingId:crypto.randomUUID(),mimeType:'audio/webm',durationMs:20000,byteLength:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),state:'ready',storagePath:null,recordedAt:f.explanation.startedAt,finishedAt:f.explanation.startedAt+20000};
  const body={uid:f.uid,sessionId:f.sessionId,sessionSecret:f.sessionSecret,recording:a};
  assert.equal((await post('/api/progress',f)).status,200);
  assert.equal((await post('/api/audio/prepare',{...body,sessionSecret:'a'.repeat(64)})).status,403);
  let prepare=await post('/api/audio/prepare',body);assert.equal(prepare.status,200,await prepare.clone().text());let upload=await prepare.json();
  const final=structuredClone(f);
  final.explanation.completedAt=a.finishedAt+10;final.reasons.startedAt=a.finishedAt+20;final.reasons.selectedAt=a.finishedAt+30;final.reasons.completedAt=a.finishedAt+40;final.posttest.answers[2].startedAt=a.finishedAt+50;final.posttest.answers[2].answeredAt=a.finishedAt+60;final.posttest.completedAt=a.finishedAt+70;
  final.explanation.audio={...a,state:'uploaded',storagePath:upload.storagePath};final.explanation.inputMethod='both';
  assert.equal((await post('/api/submit',final)).status,500);assert.deepEqual(await status(f.uid),{completed:false});
  assert.equal((await post('/api/audio/confirm',body)).status,500);
  await fetch(`${db}/_qa/fail-next?phase=audio_put`);
  assert.equal((await fetch(upload.signedUrl,{method:'PUT',headers:{'Content-Type':a.mimeType},body:bytes})).status,503);
  assert.equal((await fetch(upload.signedUrl,{method:'PUT',headers:{'Content-Type':a.mimeType},body:bytes})).status,200);
  assert.equal((await fetch(upload.signedUrl,{method:'PUT',headers:{'Content-Type':a.mimeType},body:bytes})).status,400);
  assert.equal((await fetch(`${db}/storage/v1/object/experiment-audio/${upload.storagePath}`)).status,403);
  await fetch(`${db}/_qa/fail-next?phase=confirm_experiment_audio`);
  assert.equal((await post('/api/audio/confirm',body)).status,500);
  assert.equal((await post('/api/audio/confirm',body)).status,200);
  upload=await (await post('/api/audio/prepare',body)).json();assert.equal(upload.uploaded,true);
  assert.equal((await post('/api/explanation',{...f,explanation:final.explanation})).status,200);
  assert.equal((await post('/api/submit',final)).status,200);
  assert.equal((await state(f.uid)).audio[0].verified,true);
});

test('解释题提前保存的响应丢失可重试，最终提交前完整回读，旧v2和v1均兼容',async()=>{
 const {v2Fixture,legacyFixture}=require('./test-support.cjs');
 const f=fixture('fertility',16,`qa_v3_explanation_retry_${Date.now()}`);
 f.comprehension=[{value:3,correct:false,timestamp:f.pretest.completedAt+100,feedbackPresentedAt:f.pretest.completedAt+101,feedbackVisibleMs:5000,autoAdvancedAt:f.pretest.completedAt+5101}];
 assert.equal((await post('/api/progress',f)).status,200);
 assert.equal((await post('/api/submit',f)).status,500);
 await fetch(`${db}/_qa/fail-next?phase=save_experiment_explanation_v4`);
 assert.equal((await post('/api/explanation',f)).status,500);assert.deepEqual(await status(f.uid),{completed:false});
 assert.equal((await post('/api/explanation',f)).status,200);assert.deepEqual((await state(f.uid)).session.explanation,f.explanation);
 assert.equal((await post('/api/submit',f)).status,200);
 const saved=await state(f.uid);assert.deepEqual(saved.session.comprehension,f.comprehension);assert.deepEqual(saved.session.rules,f.rules);assert.deepEqual(saved.session.reading_metrics,f.readingMetrics);
 for(const make of [v2Fixture,legacyFixture]){const old=make();old.uid=`qa_compat_${old.questionnaireVersion}_${Date.now()}`;assert.equal((await post('/api/progress',old)).status,200);assert.equal((await post('/api/submit',old)).status,200);}
});

test('统一解释提交矩阵：文字单独、音频单独、文字达标配短录音、音频达标配短文字',async()=>{
 const {createHash}=require('node:crypto');
 for(const [label,text,duration] of [['text','有效文字'.repeat(5),null],['audio','',21000],['text_short_audio','有效文字'.repeat(5),10000],['audio_short_text','补充文字',21000]]){
  const f=fixture('ai',8,`qa_v3_matrix_${label}_${Date.now()}`);f.explanation.text=text;f.explanation.effectiveCharCount=require('./test-support.cjs').createLoader()('app/lib/posttest.ts').countEffectiveCharacters(text);
  assert.equal((await post('/api/progress',f)).status,200);
  if(duration!==null){const bytes=Buffer.concat([Buffer.from('1a45dfa3','hex'),Buffer.from(label)]);const a={recordingId:crypto.randomUUID(),mimeType:'audio/webm',durationMs:duration,byteLength:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),state:'ready',storagePath:null,recordedAt:f.explanation.startedAt,finishedAt:f.explanation.startedAt+duration};
   const body={...f,recording:a};const preparation=await post('/api/audio/prepare',body);assert.equal(preparation.status,200);const prepared=await preparation.json();assert.equal((await fetch(prepared.signedUrl,{method:'PUT',headers:{'Content-Type':a.mimeType},body:bytes})).status,200);assert.equal((await post('/api/audio/confirm',body)).status,200);
   f.explanation.audio={...a,state:'uploaded',storagePath:prepared.storagePath};f.explanation.inputMethod=text?'both':'audio';f.explanation.completedAt=a.finishedAt+10;f.reasons.startedAt=a.finishedAt+20;f.reasons.selectedAt=a.finishedAt+30;f.reasons.completedAt=a.finishedAt+40;f.posttest.answers[2].startedAt=a.finishedAt+50;f.posttest.answers[2].answeredAt=a.finishedAt+60;f.posttest.completedAt=a.finishedAt+70;
  }
  assert.equal((await post('/api/explanation',f)).status,200,label);assert.deepEqual((await state(f.uid)).session.explanation,f.explanation,label+' early save');assert.deepEqual(await status(f.uid),{completed:false});assert.equal((await post('/api/submit',f)).status,200,label);
 }
});
