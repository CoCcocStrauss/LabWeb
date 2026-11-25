const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { createHash } = require("node:crypto");
const { PGlite } = require(process.env.PGLITE_MODULE || "@electric-sql/pglite");
const { root, createLoader, fixture, legacyFixture, v2Fixture } = require("./test-support.cjs");
const { canonicalJson } = createLoader()("app/lib/submissionValidation.ts");

async function database() {
  const db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  await db.exec("alter default privileges grant all on tables to service_role; alter default privileges grant all on sequences to service_role;");
  await db.exec(readFileSync(`${root}/supabase/schema.sql`, "utf8"));
  return db;
}
const secretHash = f => createHash("sha256").update(f.sessionSecret).digest("hex");
async function pretest(db, f) {
  const args = [f.uid, f.sessionId, f.conditionN, f.topicKey, f.questionnaireVersion, JSON.stringify(f.pretest)];
  if(f.questionnaireVersion==="2026-11-23-reasons-v1")return db.query("select save_experiment_pretest_v5($1,$2,$3,$4,$5,$6::jsonb,$7,$8::jsonb,$9::jsonb)",[...args,secretHash(f),JSON.stringify(f.microphonePermission),JSON.stringify(f.preReasons)]);
  if(f.questionnaireVersion==="2026-11-21-v3")return db.query("select save_experiment_pretest_v4($1,$2,$3,$4,$5,$6::jsonb,$7,$8::jsonb)",[...args,secretHash(f),JSON.stringify(f.microphonePermission)]);
  if (f.sessionSecret) return db.query("select save_experiment_pretest_v3($1,$2,$3,$4,$5,$6::jsonb,$7)", [...args, secretHash(f)]);
  return db.query("select save_experiment_pretest($1,$2,$3,$4,$5,$6::jsonb)", args);
}
async function submit(db, f, code = "ABCDEF", saveExplanation=true) {
  if(["2026-11-21-v3","2026-11-23-reasons-v1"].includes(f.questionnaireVersion)&&saveExplanation){
   const existing=(await db.query("select completed_at from experiment_sessions where uid=$1",[f.uid])).rows[0];
   if(!existing?.completed_at)await db.query(`select ${f.questionnaireVersion==="2026-11-23-reasons-v1"?"save_experiment_explanation_v5":"save_experiment_explanation_v4"}($1,$2,$3,$4::jsonb)`,[f.uid,f.sessionId,secretHash(f),JSON.stringify(f.explanation)]);
  }
  const { sessionSecret, ...payload } = f;
  const args = [JSON.stringify(payload), createHash("sha256").update(canonicalJson(payload)).digest("hex"), code];
  if(f.questionnaireVersion==="2026-11-23-reasons-v1")return db.query("select submit_experiment_v5($1::jsonb,$2,$3,$4) as code",[...args,secretHash(f)]);
  if(f.questionnaireVersion==="2026-11-21-v3")return db.query("select submit_experiment_v4($1::jsonb,$2,$3,$4) as code",[...args,secretHash(f)]);
  return sessionSecret ? db.query("select submit_experiment_v3($1::jsonb,$2,$3,$4) as code", [...args, secretHash(f)]) :
    db.query("select submit_experiment_v2($1::jsonb,$2,$3) as code", args);
}

test("真实 PostgreSQL：增量迁移保留旧数据，前测不算完成，最终事务和幂等重试", async () => {
  const db = await database();
  try {
    const f = fixture();
    await assert.rejects(submit(db, f), error => error.code === "42501");
    await pretest(db, f); await pretest(db, f);
    assert.equal((await db.query("select count(*)::int as n from experiment_sessions")).rows[0].n, 1);
    assert.equal((await db.query("select count(*)::int as n from experiments")).rows[0].n, 0);
    await assert.rejects(pretest(db, { ...f, sessionId: crypto.randomUUID() }), error => error.code === "23505");
    await assert.rejects(pretest(db, { ...f, conditionN: 16 }), error => error.code === "23505");
    assert.equal((await submit(db, f)).rows[0].code, "ABCDEF");
    assert.equal((await submit(db, f, "NEWCOD")).rows[0].code, "ABCDEF");
    assert.equal((await db.query("select count(*)::int as n from experiments")).rows[0].n, 1);
    assert.equal((await db.query("select count(*)::int as n from post_visibility")).rows[0].n, 8);
    const saved = (await db.query("select * from experiment_sessions where uid=$1", [f.uid])).rows[0];
    assert.deepEqual(saved.pretest, f.pretest); assert.deepEqual(saved.posttest, f.posttest);
    assert.deepEqual(saved.comprehension, f.comprehension); assert.ok(saved.completed_at);
    const different = structuredClone(f); different.posttest.answers[0].value = 5;
    await assert.rejects(submit(db, different), error => error.code === "23505");
    await db.exec(readFileSync(`${root}/supabase/migrations/20261121_questionnaires.sql`, "utf8"));
    assert.equal((await db.query("select count(*)::int as n from experiments")).rows[0].n, 1);
    assert.equal((await submit(db, f)).rows[0].code, "ABCDEF");
  } finally { await db.close(); }
});

test("真实 PostgreSQL：明细失败时整笔回滚，原前测保留，修正后可重试", async () => {
  const db = await database();
  try {
    const f = fixture("fertility", 16); await pretest(db, f);
    const broken = { ...f, scrollEvents: [{ postId: f.postOrder[0], action: "INVALID", timestamp: f.startTime + 1, scrollY: 0 }] };
    await assert.rejects(submit(db, broken), error => error.code === "23514");
    for (const table of ["experiments", "actions", "scroll_events", "post_visibility"]) {
      assert.equal((await db.query(`select count(*)::int as n from ${table}`)).rows[0].n, 0);
    }
    assert.equal((await db.query("select completed_at from experiment_sessions")).rows[0].completed_at, null);
    await submit(db, f);
    assert.equal((await db.query("select count(*)::int as n from post_visibility")).rows[0].n, 16);
  } finally { await db.close(); }
});

test("真实 PostgreSQL：anon 无法读取问卷或调用写入RPC", async () => {
  const db = await database();
  try {
    const f = fixture(); await pretest(db, f);
    await db.exec("set role anon");
    await assert.rejects(db.query("select * from experiment_sessions"), error => error.code === "42501");
    await assert.rejects(pretest(db, f), error => error.code === "42501");
    await assert.rejects(submit(db, f), error => error.code === "42501");
  } finally { await db.close(); }
});

test("真实 PostgreSQL：旧四表数据保留，service_role 可执行新接口", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls; alter default privileges grant all on tables to service_role; alter default privileges grant all on sequences to service_role;");
    const originalSchema = readFileSync(`${root}/supabase/schema.sql`, "utf8").split("\n-- 前后测扩展")[0];
    await db.exec(originalSchema);
    await db.query("insert into experiments(uid, condition_n, topic, topic_key, start_time_ms, end_time_ms, total_duration_ms, completion_code, end_reason) values ('legacy_uid',8,'legacy','fertility',1,2,1,'LEGACY','timeout')");
    await db.exec(readFileSync(`${root}/supabase/migrations/20261121_questionnaires.sql`, "utf8"));
    assert.equal((await db.query("select completion_code from experiments where uid='legacy_uid'")).rows[0].completion_code, "LEGACY");
    await db.exec(readFileSync(`${root}/supabase/migrations/20261121_posttasks_audio.sql`, "utf8"));
    await db.exec(readFileSync(`${root}/supabase/migrations/20261121_masonry_protocol_v3.sql`,"utf8"));
    await db.exec("set role service_role");
    const f = fixture("fertility", 48); await pretest(db, f); await submit(db, f);
    assert.equal((await db.query("select count(*)::int as n from experiments")).rows[0].n, 2);
  } finally { await db.close(); }
});

test("真实 PostgreSQL：音频必须验证，秘密错误及跨会话被拒绝，旧问卷仍可保存", async () => {
  const db = await database();
  try {
    const f = fixture(); await pretest(db, f);
    const a = {recordingId:crypto.randomUUID(),mimeType:"audio/webm",durationMs:20000,byteLength:100,sha256:"a".repeat(64),state:"uploaded",recordedAt:f.explanation.startedAt,finishedAt:f.explanation.startedAt+20000};
    a.storagePath = `${f.sessionId}/${a.recordingId}.webm`;
    f.explanation = {...f.explanation, text:"",effectiveCharCount:0,inputMethod:"audio",audio:a};
    await assert.rejects(submit(db,f), e => e.code === "23514");
    const args = [f.uid,f.sessionId,secretHash(f),a.recordingId,a.storagePath,a.mimeType,a.byteLength,a.durationMs,a.sha256];
    await db.query("select prepare_experiment_audio($1,$2,$3,$4,$5,$6,$7,$8,$9)",args);
    await assert.rejects(submit(db,f), e => e.code === "23514");
    await assert.rejects(db.query("select confirm_experiment_audio($1,$2,$3,$4)",[f.uid,f.sessionId,"b".repeat(64),a.recordingId]),e=>e.code==="42501");
    await db.query("select confirm_experiment_audio($1,$2,$3,$4)",[f.uid,f.sessionId,secretHash(f),a.recordingId]);
    await submit(db,f);
    const legacy = legacyFixture(); legacy.uid = "qa_legacy_protocol";
    await pretest(db,legacy); await submit(db,legacy);
    assert.equal((await db.query("select count(*)::int n from experiments")).rows[0].n,2);
  } finally { await db.close(); }
});

test('Supabase存储迁移：桶私有，已有宽泛policy仍不能向匿名用户开放音频',async()=>{
 const db=await database();try {
  await db.exec("create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit integer,allowed_mime_types text[]);create table storage.objects(bucket_id text);alter table storage.objects enable row level security;grant usage on schema storage to anon,authenticated;grant select on storage.objects to anon,authenticated;create policy broad_read on storage.objects for select to anon,authenticated using(true);");
  await db.exec(readFileSync(`${root}/supabase/migrations/20261121_audio_storage.sql`,'utf8'));
  await db.exec("insert into storage.objects values('experiment-audio'),('other');");
  assert.equal((await db.query("select public from storage.buckets where id='experiment-audio'")).rows[0].public,false);
  await db.exec('set role anon');assert.deepEqual((await db.query('select bucket_id from storage.objects')).rows,[{bucket_id:'other'}]);
 }finally{await db.close();}
});

test('v3解释先独立保存、旧v2继续可提交、错答纠正与过程数据完整留存',async()=>{
 const db=await database();try{
  const f=fixture();await pretest(db,f);await assert.rejects(submit(db,f,'ABCDEF',false),e=>e.code==='23514');
  await submit(db,f);const row=(await db.query('select rules,permission_check,reading_metrics,explanation_saved_at from experiment_sessions where uid=$1',[f.uid])).rows[0];
  assert.deepEqual(row.rules,f.rules);assert.deepEqual(row.permission_check,f.microphonePermission);assert.deepEqual(row.reading_metrics,f.readingMetrics);assert.ok(row.explanation_saved_at);
  const old=v2Fixture();old.uid='qa_v2_migration_compat';await pretest(db,old);await submit(db,old);assert.equal((await db.query('select questionnaire_version from experiment_sessions where uid=$1',[old.uid])).rows[0].questionnaire_version,'2026-11-21-v2');
 }finally{await db.close();}
});

test('解释题较早的超时请求不能覆盖较新的重试内容',async()=>{
 const db=await database();try{const f=fixture();await pretest(db,f);const newer={...f.explanation,completedAt:f.explanation.completedAt+100,text:'更新后的解释文字'.repeat(4)};newer.effectiveCharCount=createLoader()('app/lib/posttest.ts').countEffectiveCharacters(newer.text);
 await db.query('select save_experiment_explanation_v4($1,$2,$3,$4::jsonb)',[f.uid,f.sessionId,secretHash(f),JSON.stringify(newer)]);
 await db.query('select save_experiment_explanation_v4($1,$2,$3,$4::jsonb)',[f.uid,f.sessionId,secretHash(f),JSON.stringify(f.explanation)]);
 assert.deepEqual((await db.query('select explanation from experiment_sessions where uid=$1',[f.uid])).rows[0].explanation,newer);
 }finally{await db.close();}
});


test("理由新版增量迁移、完整前测保存、最终三模块入库及幂等，不更改旧v3",async()=>{
 const {reasonsFixture}=require('./test-reasons-support.cjs'),db=new PGlite();try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
  await db.exec(readFileSync(`${root}/supabase/schema.sql`,'utf8').split('-- Additive reasons protocol.')[0]);
  const old=fixture('ai',8,'test_db_v3_before_v4');await pretest(db,old);await submit(db,old);
  const before=(await db.query('select * from experiment_sessions where uid=$1',[old.uid])).rows[0];
  const oldExperiment=(await db.query('select * from experiments where uid=$1',[old.uid])).rows[0];
  await db.exec(readFileSync(`${root}/supabase/release-reasons-20261123.sql`,'utf8'));
  await db.exec(readFileSync(`${root}/supabase/release-reasons-20261123.sql`,'utf8'));
  const after=(await db.query('select * from experiment_sessions where uid=$1',[old.uid])).rows[0];
  for(const k of Object.keys(before))assert.deepEqual(after[k],before[k]);
  assert.deepEqual((await db.query('select * from experiments where uid=$1',[old.uid])).rows[0],oldExperiment);

  for(const topic of ['ai','fertility']){
   const f=reasonsFixture(topic,48,'test_db_reasons_'+topic);await pretest(db,f);
   let saved=(await db.query('select * from experiment_sessions where uid=$1',[f.uid])).rows[0];assert.deepEqual(saved.pre_reasons,f.preReasons);assert.equal(saved.completed_at,null);
   const first=await submit(db,f);const second=await submit(db,f);assert.equal(first.rows[0].code,second.rows[0].code);
   saved=(await db.query('select * from experiment_sessions where uid=$1',[f.uid])).rows[0];assert.deepEqual(saved.pre_reasons,f.preReasons);assert.deepEqual(saved.post_reasons,f.postReasons);assert.deepEqual(saved.interaction_comparison,f.interactionComparison);assert.equal(saved.reasons,null);assert.ok(saved.completed_at);
   assert.equal((await db.query('select count(*)::int as n from post_visibility where uid=$1',[f.uid])).rows[0].n,48);
  }
  const later=fixture('ai',8,'test_db_v3_after_v4');await pretest(db,later);await submit(db,later);assert.ok((await db.query('select completed_at from experiment_sessions where uid=$1',[later.uid])).rows[0].completed_at);
 }finally{await db.close();}
});
test("理由新版拒绝前测理由覆盖、缺少新模块与未提前保存解释；事务不产生完成记录",async()=>{
 const {reasonsFixture}=require('./test-reasons-support.cjs'),db=await database();try{
  const f=reasonsFixture();await pretest(db,f);const g=structuredClone(f);g.preReasons.selectedIds=['feeling'];await assert.rejects(pretest(db,g));
  await assert.rejects(submit(db,f,'ABCDEF',false));const missing=structuredClone(f);delete missing.interactionComparison;await assert.rejects(submit(db,missing));
  assert.equal((await db.query('select completed_at from experiment_sessions where uid=$1',[f.uid])).rows[0].completed_at,null);assert.equal((await db.query('select count(*)::int as n from experiments where uid=$1',[f.uid])).rows[0].n,0);
  await submit(db,f);assert.ok((await db.query('select completed_at from experiment_sessions where uid=$1',[f.uid])).rows[0].completed_at);
 }finally{await db.close();}
});

test('盲评增量迁移保留旧16条数据，24条与新版完成字段、取消转发可存储',async()=>{const db=await database();try{const old=fixture('ai',16,'test_old16_before_blind');await pretest(db,old);await submit(db,old);const before=(await db.query('select * from experiments where uid=$1',[old.uid])).rows[0];await db.exec(readFileSync(`${root}/supabase/release-blinded-20261124.sql`,'utf8'));assert.deepEqual((await db.query('select * from experiments where uid=$1',[old.uid])).rows[0],before);const {blindFixture}=require('./test-blinded-support.cjs'),f=blindFixture('fertility',24,'test_db_blind24',4);await db.query('select save_experiment_pretest_v7($1,$2,$3,$4,$5,$6::jsonb,$7,$8::jsonb)',[f.uid,f.sessionId,f.conditionN,f.topicKey,f.questionnaireVersion,JSON.stringify(f.pretest),secretHash(f),JSON.stringify(f.microphonePermission)]);await db.query('select save_experiment_explanation_v7($1,$2,$3,$4::jsonb)',[f.uid,f.sessionId,secretHash(f),JSON.stringify(f.explanation)]);const {sessionSecret,...payload}=f,args=[JSON.stringify(payload),createHash('sha256').update(canonicalJson(payload)).digest('hex'),'ABCDEF',secretHash(f)];await db.query('select submit_experiment_v7($1::jsonb,$2,$3,$4)',args);await db.query('select submit_experiment_v7($1::jsonb,$2,$3,$4)',args);const saved=(await db.query('select * from experiment_sessions where uid=$1',[f.uid])).rows[0];assert.deepEqual(saved.blinded_post_evaluations,f.blindedPostEvaluations);assert.ok(saved.completed_at);const exp=(await db.query('select * from experiments where uid=$1',[f.uid])).rows[0];assert.equal(exp.condition_n,24);assert.equal(exp.final_share_count,4);assert.equal(exp.met_share_goal,true);}finally{await db.close();}});

test('全文可见分段JSON与短卡曝光各自入库，重试不重复累计',async()=>{
 const db=await database();try{
  const {trackedBlindFixture}=require('./test-blinded-support.cjs'),f=trackedBlindFixture('fertility',48,'test_db_detail_intervals');
  await db.query('select save_experiment_pretest_v7($1,$2,$3,$4,$5,$6::jsonb,$7,$8::jsonb)',[f.uid,f.sessionId,f.conditionN,f.topicKey,f.questionnaireVersion,JSON.stringify(f.pretest),secretHash(f),JSON.stringify(f.microphonePermission)]);
  await db.query('select save_experiment_explanation_v7($1,$2,$3,$4::jsonb)',[f.uid,f.sessionId,secretHash(f),JSON.stringify(f.explanation)]);
  const {sessionSecret,...payload}=f,args=[JSON.stringify(payload),createHash('sha256').update(canonicalJson(payload)).digest('hex'),'ABCDEF',secretHash(f)];
  await db.query('select submit_experiment_v7($1::jsonb,$2,$3,$4)',args);await db.query('select submit_experiment_v7($1::jsonb,$2,$3,$4)',args);
  const saved=(await db.query('select reading_metrics from experiment_sessions where uid=$1',[f.uid])).rows[0];
  assert.deepEqual(saved.reading_metrics.detailIntervals,f.readingMetrics.detailIntervals);
  assert.equal(saved.reading_metrics.detailIntervals.reduce((sum,i)=>sum+i.durationMs,0),2500);
  const exposure=(await db.query('select total_visible_ms from post_visibility where uid=$1 and post_id=$2',[f.uid,f.postOrder[0]])).rows;
  assert.equal(exposure.length,1);assert.equal(exposure[0].total_visible_ms,1000);
 }finally{await db.close();}
});

test('三步规则与切屏汇总沿用JSONB，核验SQL只读且不改写旧数据',async()=>{
 const db=await database();try{
  const {trackedBlindFixture}=require('./test-blinded-support.cjs'),f=trackedBlindFixture('ai',24,'test_tutorial_20261125_24_01');
  Object.assign(f.readingMetrics,{attentionVersion:'reading-visibility-v1',hiddenCount:1,totalHiddenMs:3000,hiddenAtMs:null});
  await db.query('select save_experiment_pretest_v7($1,$2,$3,$4,$5,$6::jsonb,$7,$8::jsonb)',[f.uid,f.sessionId,f.conditionN,f.topicKey,f.questionnaireVersion,JSON.stringify(f.pretest),secretHash(f),JSON.stringify(f.microphonePermission)]);
  await db.query('select save_experiment_explanation_v7($1,$2,$3,$4::jsonb)',[f.uid,f.sessionId,secretHash(f),JSON.stringify(f.explanation)]);
  const {sessionSecret,...payload}=f;await db.query('select submit_experiment_v7($1::jsonb,$2,$3,$4)',[JSON.stringify(payload),createHash('sha256').update(canonicalJson(payload)).digest('hex'),'ABCDEF',secretHash(f)]);
  const before=(await db.query('select rules,reading_metrics from experiment_sessions where uid=$1',[f.uid])).rows[0];
  assert.deepEqual(before.rules,f.rules);assert.equal(before.rules.items.length,3);assert.equal(before.reading_metrics.totalHiddenMs,3000);
  await db.exec(readFileSync(`${root}/supabase/check-tutorial-attention-20261125.sql`,'utf8'));
  assert.deepEqual((await db.query('select rules,reading_metrics from experiment_sessions where uid=$1',[f.uid])).rows[0],before);
 }finally{await db.close();}
});

test('新版语料增量SQL可重跑、旧v6数据不变、v7严格隔离版本并完整入库',async()=>{
 const db=await database();try{
  const {blindFixture}=require('./test-blinded-support.cjs'),f=blindFixture('ai',24,'test_materials_v5_sql'),old={...f,sessionId:require('node:crypto').randomUUID(),uid:'test_materials_old_v6_sql',questionnaireVersion:'2026-11-24-v4'};
  const args=x=>[x.uid,x.sessionId,x.conditionN,x.topicKey,x.questionnaireVersion,JSON.stringify(x.pretest),secretHash(x),JSON.stringify(x.microphonePermission)];
  await db.query('select save_experiment_pretest_v6($1,$2,$3,$4,$5,$6::jsonb,$7,$8::jsonb)',args(old));
  const before=(await db.query('select * from experiment_sessions where uid=$1',[old.uid])).rows[0];
  const sql=readFileSync(`${root}/supabase/release-materials-20261125.sql`,'utf8');await db.exec(sql);await db.exec(sql);
  assert.deepEqual((await db.query('select * from experiment_sessions where uid=$1',[old.uid])).rows[0],before);
  await assert.rejects(db.query('select save_experiment_pretest_v7($1,$2,$3,$4,$5,$6::jsonb,$7,$8::jsonb)',args(old)),/Invalid session/);
  await assert.rejects(db.query('select save_experiment_pretest_v6($1,$2,$3,$4,$5,$6::jsonb,$7,$8::jsonb)',args(f)),/Invalid session/);
  await db.query('select save_experiment_pretest_v7($1,$2,$3,$4,$5,$6::jsonb,$7,$8::jsonb)',args(f));
  await db.query('select save_experiment_explanation_v7($1,$2,$3,$4::jsonb)',[f.uid,f.sessionId,secretHash(f),JSON.stringify(f.explanation)]);
  const {sessionSecret,...payload}=f;await db.query('select submit_experiment_v7($1::jsonb,$2,$3,$4)',[JSON.stringify(payload),createHash('sha256').update(canonicalJson(payload)).digest('hex'),'ABCDEF',secretHash(f)]);
  const s=(await db.query('select * from experiment_sessions where uid=$1',[f.uid])).rows[0];assert.equal(s.questionnaire_version,'2026-11-25-v5');assert.equal(s.topic_key,'ai');assert.deepEqual(s.reading_metrics,f.readingMetrics);assert.deepEqual(s.blinded_post_evaluations,f.blindedPostEvaluations);assert.ok(s.completed_at);
 }finally{await db.close();}
});
