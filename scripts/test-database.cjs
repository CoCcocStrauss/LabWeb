const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { createHash } = require("node:crypto");
const { PGlite } = require(process.env.PGLITE_MODULE || "@electric-sql/pglite");
const { root, createLoader, fixture, legacyFixture } = require("./test-support.cjs");
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
  if (f.sessionSecret) return db.query("select save_experiment_pretest_v3($1,$2,$3,$4,$5,$6::jsonb,$7)", [...args, secretHash(f)]);
  return db.query("select save_experiment_pretest($1,$2,$3,$4,$5,$6::jsonb)", args);
}
async function submit(db, f, code = "ABCDEF") {
  const { sessionSecret, ...payload } = f;
  const args = [JSON.stringify(payload), createHash("sha256").update(canonicalJson(payload)).digest("hex"), code];
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
