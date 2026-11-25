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

test('理由新版实际HTTP：六条件前后理由与互动比较完整保存，最终保存前不完成',async()=>{
 const {reasonsFixture,refreshNewTasks}=require('./test-reasons-support.cjs');
 for(const topic of ['ai','fertility'])for(const n of [8,16,48]){
  const f=reasonsFixture(topic,n,`test_http_reasons_${topic}_${n}_${Date.now()}`);
  const load=require('./test-support.cjs').createLoader(),p=Object.values(load('app/lib/materialsRegistry.ts').getMaterialsForTopic(topic).materials).flat().find(x=>x.id===f.postOrder[0]);
  f.actions=[{type:'like',postId:p.id,stance:p.stance,sourceLevel:p.sourceLevel,quality:p.quality,timestamp:f.startTime+1}];refreshNewTasks(f);
  let response=await post('/api/progress',f);assert.equal(response.status,200,await response.clone().text());assert.deepEqual(await status(f.uid),{completed:false});assert.deepEqual((await state(f.uid)).session.pre_reasons,f.preReasons);
  response=await post('/api/explanation',f);assert.equal(response.status,200,await response.clone().text());assert.deepEqual(await status(f.uid),{completed:false});response=await post('/api/submit',f);assert.equal(response.status,200,await response.clone().text());const code=(await response.json()).completionCode;
  const saved=await state(f.uid);assert.deepEqual(saved.session.post_reasons,f.postReasons);assert.deepEqual(saved.session.interaction_comparison,f.interactionComparison);assert.equal(saved.session.reasons,null);assert.equal(saved.counts.post_visibility,n);assert.deepEqual(await status(f.uid),{completed:true});assert.equal((await(await post('/api/submit',f)).json()).completionCode,code);
 }
});
test('理由新版HTTP拒绝缺少前测理由、伪造候选与跨版本提交',async()=>{
 const {reasonsFixture}=require('./test-reasons-support.cjs'),f=reasonsFixture();const missing=structuredClone(f);delete missing.readingMetrics;assert.equal((await post('/api/submit',missing)).status,400);const g=structuredClone(f);delete g.preReasons;assert.equal((await post('/api/progress',g)).status,400);await post('/api/progress',f);await post('/api/explanation',f);f.interactionComparison.candidatePostIds=['not_presented'];assert.equal((await post('/api/submit',f)).status,400);assert.deepEqual(await status(f.uid),{completed:false});
});

test('理由新版保留补充短录音并与文字、比较模块一并保存',async()=>{
 const {reasonsFixture,doneReasons}=require('./test-reasons-support.cjs'),{createHash}=require('node:crypto'),f=reasonsFixture('fertility',8,'test_http_reasons_audio_'+Date.now());
 const bytes=Buffer.concat([Buffer.from('1a45dfa3','hex'),Buffer.from('new-protocol-qa-audio')]),a={recordingId:crypto.randomUUID(),mimeType:'audio/webm',durationMs:10000,byteLength:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),state:'ready',storagePath:null,recordedAt:f.explanation.startedAt,finishedAt:f.explanation.startedAt+10000};
 assert.equal((await post('/api/progress',f)).status,200);const body={uid:f.uid,sessionId:f.sessionId,sessionSecret:f.sessionSecret,recording:a};const prepared=await post('/api/audio/prepare',body);assert.equal(prepared.status,200,await prepared.clone().text());const upload=await prepared.json();assert.equal((await fetch(upload.signedUrl,{method:'PUT',headers:{'Content-Type':a.mimeType},body:bytes})).status,200);assert.equal((await post('/api/audio/confirm',body)).status,200);
 f.explanation.audio={...a,state:'uploaded',storagePath:upload.storagePath};f.explanation.inputMethod='both';f.explanation.completedAt=a.finishedAt+1;f.postReasons=doneReasons(f.topicKey,'posttest',f.explanation.completedAt+1,f.preReasons);f.posttest.answers[2].startedAt=f.postReasons.completedAt+1;f.posttest.answers[2].answeredAt=f.postReasons.completedAt+2;f.posttest.completedAt=f.postReasons.completedAt+3;
 assert.equal((await post('/api/explanation',f)).status,200);const response=await post('/api/submit',f);assert.equal(response.status,200,await response.clone().text());const saved=await state(f.uid);assert.equal(saved.counts.experiment_audio,1);assert.equal(saved.session.explanation.audio.durationMs,10000);assert.equal(saved.session.explanation.inputMethod,'both');assert.deepEqual(saved.session.post_reasons,f.postReasons);
});

test('150秒新版：六条件、四帖盲评与完成元数据真实保存',async()=>{const {blindFixture}=require('./test-blinded-support.cjs');for(const topic of ['ai','fertility'])for(const n of [8,24,48]){const f=blindFixture(topic,n,'test_http_blind_'+topic+n+'_'+Date.now(),4);let r=await post('/api/progress',f);assert.equal(r.status,200,await r.clone().text());r=await post('/api/explanation',f);assert.equal(r.status,200,await r.clone().text());r=await post('/api/submit',f);assert.equal(r.status,200,await r.clone().text());const saved=await state(f.uid);assert.deepEqual(saved.session.blinded_post_evaluations,f.blindedPostEvaluations);assert.equal(saved.experiment.final_share_count,4);assert.equal(saved.experiment.met_share_goal,true);assert.equal(saved.counts.post_visibility,n);assert.equal((await post('/api/submit',f)).status,200);}});
test('150秒新版补充录音与盲评、解释一起保存',async()=>{const {blindFixture}=require('./test-blinded-support.cjs'),{createHash}=require('node:crypto'),f=blindFixture('ai',24,'test_blind_audio_'+Date.now(),2),bytes=Buffer.concat([Buffer.from('1a45dfa3','hex'),Buffer.from('blind-protocol-local-audio')]),audio={recordingId:crypto.randomUUID(),mimeType:'audio/webm',durationMs:10000,byteLength:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),state:'ready',storagePath:null,recordedAt:f.explanation.startedAt,finishedAt:f.explanation.startedAt+10000};assert.equal((await post('/api/progress',f)).status,200);const body={uid:f.uid,sessionId:f.sessionId,sessionSecret:f.sessionSecret,recording:audio},prepare=await post('/api/audio/prepare',body);assert.equal(prepare.status,200);const upload=await prepare.json();assert.equal((await fetch(upload.signedUrl,{method:'PUT',headers:{'Content-Type':audio.mimeType},body:bytes})).status,200);assert.equal((await post('/api/audio/confirm',body)).status,200);f.explanation.audio={...audio,state:'uploaded',storagePath:upload.storagePath};f.explanation.inputMethod='both';f.explanation.completedAt=audio.finishedAt+1;f.posttest.answers[2].startedAt=audio.finishedAt+2;f.posttest.answers[2].answeredAt=audio.finishedAt+3;f.posttest.completedAt=audio.finishedAt+4;assert.equal((await post('/api/explanation',f)).status,200);const r=await post('/api/submit',f);assert.equal(r.status,200,await r.clone().text());const saved=await state(f.uid);assert.equal(saved.counts.experiment_audio,1);assert.equal(saved.session.explanation.audio.durationMs,10000);assert.deepEqual(saved.session.blinded_post_evaluations,f.blindedPostEvaluations);});

test('48条新版全文可见区间及短卡曝光分别完整保存，重复提交不累加',async()=>{
 const {trackedBlindFixture}=require('./test-blinded-support.cjs'),f=trackedBlindFixture('fertility',48,'test_detail_http_'+Date.now());
 assert.equal((await post('/api/progress',f)).status,200);assert.equal((await post('/api/explanation',f)).status,200);
 let r=await post('/api/submit',f);assert.equal(r.status,200,await r.clone().text());
 r=await post('/api/submit',f);assert.equal(r.status,200,await r.clone().text());
 const saved=await state(f.uid),intervals=saved.session.reading_metrics.detailIntervals;
 assert.deepEqual(intervals,f.readingMetrics.detailIntervals);assert.equal(intervals.reduce((sum,i)=>sum+i.durationMs,0),2500);
 assert.equal(f.postVisibilitySummary[f.postOrder[0]].totalVisibleMs,1000);
 assert.equal(saved.experiment.uid,f.uid);assert.equal(saved.counts.post_visibility,48);
});
