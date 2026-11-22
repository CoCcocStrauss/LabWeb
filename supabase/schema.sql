-- LabWeb 实验数据库 schema（Supabase / Postgres）
-- 使用方式：全新项目直接在 SQL Editor 中完整执行本文件即可。
-- 设计对应关系：
--   experiments      <- 原 Firebase experiments/{uid} 顶层字段
--   actions          <- 原 experiments/{uid}/actions 数组，每个元素一行
--   scroll_events    <- 原 experiments/{uid}/scrollEvents 数组，每个元素一行
--   post_visibility  <- 原 experiments/{uid}/postVisibilitySummary 对象，每个 key 一行
--
-- 【已执行过旧版schema.sql的项目（新增topic_key字段）请先运行下面两句迁移语句，
--  再执行本文件剩余部分（create table if not exists 对已存在的表不会有影响，
--  但 create or replace function 无法直接改参数列表，所以要先手动 drop 旧函数）】：
--
--   alter table experiments add column if not exists topic_key text;
--   update experiments set topic_key = 'fertility' where topic_key is null;
--   alter table experiments alter column topic_key set not null;
--   alter table experiments add constraint experiments_topic_key_check
--     check (topic_key in ('fertility', 'ai', 'eldercare'));
--   drop function if exists submit_experiment(
--     text, integer, text, bigint, bigint, integer, text, text, integer, text[], jsonb, jsonb, jsonb
--   );

create table if not exists experiments (
  uid                 text primary key,
  condition_n         integer not null check (condition_n in (8, 16, 48)),
  topic               text not null,
  topic_key           text not null check (topic_key in ('fertility', 'ai', 'eldercare')),
  start_time_ms       bigint not null,
  end_time_ms         bigint not null,
  total_duration_ms   integer not null,
  completion_code     text not null,
  end_reason          text not null check (end_reason in ('manual', 'timeout')),
  max_scroll_y        integer not null default 0,
  post_order          text[] not null default '{}',
  created_at          timestamptz not null default now()
);

create table if not exists actions (
  id            bigint generated always as identity primary key,
  uid           text not null references experiments(uid) on delete cascade,
  type          text not null check (type in ('share', 'like', 'unlike', 'user_post')),
  post_id       text,
  timestamp_ms  bigint not null,
  order_num     integer,
  stance        text,
  source_level  text,
  quality       text,
  content       text,
  char_count    integer
);
create index if not exists idx_actions_uid on actions(uid);

create table if not exists scroll_events (
  id            bigint generated always as identity primary key,
  uid           text not null references experiments(uid) on delete cascade,
  post_id       text not null,
  action        text not null check (action in ('enter_viewport', 'leave_viewport')),
  timestamp_ms  bigint not null,
  scroll_y      integer not null default 0
);
create index if not exists idx_scroll_events_uid on scroll_events(uid);

create table if not exists post_visibility (
  id                bigint generated always as identity primary key,
  uid               text not null references experiments(uid) on delete cascade,
  post_id           text not null,
  total_visible_ms  integer not null default 0,
  first_seen_at_ms  bigint,
  unique (uid, post_id)
);
create index if not exists idx_post_visibility_uid on post_visibility(uid);

-- 安全策略：四张表全部开启 RLS，且不添加任何 policy。
-- 这意味着 anon / authenticated 角色对这些表完全没有读写权限（默认拒绝）。
-- 写入只通过服务端的 service_role key 调用下面的 RPC 完成，service_role 会自动绕过 RLS。
alter table experiments     enable row level security;
alter table actions         enable row level security;
alter table scroll_events   enable row level security;
alter table post_visibility enable row level security;

-- 原子写入：一次 RPC 调用内完成 4 张表的插入。
-- 函数在同一个隐式事务中执行，任意一步失败（例如 uid 已存在导致主键冲突）
-- 都会让整个函数调用回滚，不会出现"实验主记录写入成功但明细写入失败"的半成品数据。
create or replace function submit_experiment(
  p_uid               text,
  p_condition_n       integer,
  p_topic             text,
  p_topic_key         text,
  p_start_time_ms     bigint,
  p_end_time_ms       bigint,
  p_total_duration_ms integer,
  p_completion_code   text,
  p_end_reason        text,
  p_max_scroll_y      integer,
  p_post_order        text[],
  p_actions           jsonb,
  p_scroll_events     jsonb,
  p_post_visibility   jsonb
) returns void
language plpgsql
as $$
begin
  insert into experiments (
    uid, condition_n, topic, topic_key, start_time_ms, end_time_ms, total_duration_ms,
    completion_code, end_reason, max_scroll_y, post_order
  ) values (
    p_uid, p_condition_n, p_topic, p_topic_key, p_start_time_ms, p_end_time_ms, p_total_duration_ms,
    p_completion_code, p_end_reason, p_max_scroll_y, p_post_order
  );

  insert into actions (
    uid, type, post_id, timestamp_ms, order_num, stance, source_level, quality, content, char_count
  )
  select
    p_uid,
    a->>'type',
    a->>'postId',
    (a->>'timestamp')::bigint,
    (a->>'order')::integer,
    a->>'stance',
    a->>'sourceLevel',
    a->>'quality',
    a->>'content',
    (a->>'charCount')::integer
  from jsonb_array_elements(coalesce(p_actions, '[]'::jsonb)) as a;

  insert into scroll_events (uid, post_id, action, timestamp_ms, scroll_y)
  select
    p_uid,
    e->>'postId',
    e->>'action',
    (e->>'timestamp')::bigint,
    coalesce((e->>'scrollY')::integer, 0)
  from jsonb_array_elements(coalesce(p_scroll_events, '[]'::jsonb)) as e;

  insert into post_visibility (uid, post_id, total_visible_ms, first_seen_at_ms)
  select
    p_uid,
    kv.key,
    coalesce((kv.value->>'totalVisibleMs')::integer, 0),
    (kv.value->>'firstSeenAt')::bigint
  from jsonb_each(coalesce(p_post_visibility, '{}'::jsonb)) as kv;
end;
$$;

-- 前后测扩展（与 migrations/20261121_questionnaires.sql 同步）
-- 增量迁移：保留现有四表、旧记录及14参数提交函数。
-- 本文件只准备，未自动执行；在发布新代码前由实验负责人执行。
begin;

create table if not exists experiment_sessions (
  uid text primary key,
  session_id uuid not null unique,
  condition_n integer not null check (condition_n in (8, 16, 48)),
  topic_key text not null check (topic_key in ('fertility', 'ai')),
  questionnaire_version text not null,
  pretest jsonb not null,
  comprehension jsonb,
  posttest jsonb,
  submission_hash text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((completed_at is null and submission_hash is null) or
         (completed_at is not null and submission_hash is not null and posttest is not null and comprehension is not null))
);
alter table experiment_sessions enable row level security;
grant select, insert, update on experiment_sessions to service_role;

-- 前测单独保存，不在 experiments 中创建“完成”记录。
create or replace function save_experiment_pretest(
  p_uid text, p_session_id uuid, p_condition_n integer,
  p_topic_key text, p_questionnaire_version text, p_pretest jsonb
) returns void language plpgsql as $$
declare existing experiment_sessions%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_uid, 0));
  select * into existing from experiment_sessions where uid = p_uid for update;
  if found then
    if existing.session_id = p_session_id and existing.condition_n = p_condition_n
       and existing.topic_key = p_topic_key and existing.questionnaire_version = p_questionnaire_version
       and existing.pretest = p_pretest then return; end if;
    raise exception 'Conflicting session' using errcode = '23505';
  end if;
  if exists(select 1 from experiments where uid = p_uid) then
    raise exception 'UID already completed' using errcode = '23505';
  end if;
  insert into experiment_sessions(uid, session_id, condition_n, topic_key, questionnaire_version, pretest)
    values (p_uid, p_session_id, p_condition_n, p_topic_key, p_questionnaire_version, p_pretest);
end;
$$;

-- 原阅读明细与后测在同一个事务完成。完全相同的重试返回原完成码。
create or replace function submit_experiment_v2(
  p_payload jsonb, p_payload_hash text, p_completion_code text
) returns text language plpgsql as $$
declare
  existing experiment_sessions%rowtype;
  existing_code text;
  participant_uid text := p_payload->>'uid';
begin
  perform pg_advisory_xact_lock(hashtextextended(participant_uid, 0));
  select * into existing from experiment_sessions where uid = participant_uid for update;
  if not found then raise exception 'Pretest must be saved first' using errcode = '23514'; end if;
  if existing.session_id::text is distinct from p_payload->>'sessionId'
     or existing.condition_n is distinct from (p_payload->>'conditionN')::integer
     or existing.topic_key is distinct from p_payload->>'topicKey'
     or existing.questionnaire_version is distinct from p_payload->>'questionnaireVersion'
     or existing.pretest is distinct from p_payload->'pretest' then
    raise exception 'Conflicting session' using errcode = '23505';
  end if;
  select completion_code into existing_code from experiments where uid = participant_uid;
  if found then
    if existing.completed_at is not null and existing.submission_hash = p_payload_hash then return existing_code; end if;
    raise exception 'Conflicting submission' using errcode = '23505';
  end if;
  perform submit_experiment(
    participant_uid, (p_payload->>'conditionN')::integer, p_payload->>'topic', p_payload->>'topicKey',
    (p_payload->>'startTime')::bigint, (p_payload->>'endTime')::bigint,
    ((p_payload->>'endTime')::bigint - (p_payload->>'startTime')::bigint)::integer,
    p_completion_code, p_payload->>'endReason', (p_payload->>'maxScrollY')::integer,
    array(select jsonb_array_elements_text(p_payload->'postOrder')),
    p_payload->'actions', p_payload->'scrollEvents', p_payload->'postVisibilitySummary'
  );
  update experiment_sessions set comprehension = p_payload->'comprehension', posttest = p_payload->'posttest',
    submission_hash = p_payload_hash, completed_at = now() where uid = participant_uid;
  return p_completion_code;
end;
$$;

revoke all on function save_experiment_pretest(text, uuid, integer, text, text, jsonb) from public, anon, authenticated;
revoke all on function submit_experiment_v2(jsonb, text, text) from public, anon, authenticated;
grant execute on function save_experiment_pretest(text, uuid, integer, text, text, jsonb) to service_role;
grant execute on function submit_experiment_v2(jsonb, text, text) to service_role;

commit;

-- 新后测与音频扩展
-- 在20261121_questionnaires.sql之后执行。仅准备，未执行线上迁移。
begin;
alter table experiment_sessions add column if not exists session_secret_hash text;
alter table experiment_sessions add column if not exists recognition jsonb;
alter table experiment_sessions add column if not exists explanation jsonb;
alter table experiment_sessions add column if not exists reasons jsonb;
alter table experiment_sessions add column if not exists presented_posts jsonb;
alter table experiment_sessions add column if not exists interruptions jsonb;

create table if not exists experiment_audio (
  recording_id uuid primary key,
  uid text not null references experiment_sessions(uid),
  session_id uuid not null,
  storage_path text not null unique,
  mime_type text not null,
  byte_length integer not null check (byte_length > 0 and byte_length <= 20971520),
  duration_ms integer not null check (duration_ms >= 0),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  verified_at timestamptz
);
alter table experiment_audio enable row level security;
grant select, insert, update on experiment_audio to service_role;
create index if not exists experiment_audio_uid_idx on experiment_audio(uid);

create or replace function save_experiment_pretest_v3(
  p_uid text, p_session_id uuid, p_condition_n integer, p_topic_key text,
  p_questionnaire_version text, p_pretest jsonb, p_secret_hash text
) returns void language plpgsql as $$
declare existing_hash text;
begin
  if p_questionnaire_version is distinct from '2026-11-21-v2' or p_secret_hash is null or p_secret_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid questionnaire session' using errcode = '23514';
  end if;
  perform save_experiment_pretest(p_uid,p_session_id,p_condition_n,p_topic_key,p_questionnaire_version,p_pretest);
  select session_secret_hash into existing_hash from experiment_sessions where uid = p_uid for update;
  if existing_hash is not null and existing_hash <> p_secret_hash then raise exception 'Conflicting session secret' using errcode='23505'; end if;
  update experiment_sessions set session_secret_hash = p_secret_hash where uid = p_uid;
end;
$$;

create or replace function prepare_experiment_audio(
  p_uid text, p_session_id uuid, p_secret_hash text, p_recording_id uuid,
  p_storage_path text, p_mime_type text, p_byte_length integer, p_duration_ms integer, p_sha256 text
) returns boolean language plpgsql as $$
declare s experiment_sessions%rowtype; a experiment_audio%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_uid,0));
  select * into s from experiment_sessions where uid=p_uid for update;
  if not found or s.session_id is distinct from p_session_id or s.session_secret_hash is null or
     s.session_secret_hash is distinct from p_secret_hash or s.completed_at is not null then
    raise exception 'Invalid audio session' using errcode='42501';
  end if;
  select * into a from experiment_audio where recording_id=p_recording_id;
  if found then
    if a.uid is distinct from p_uid or a.session_id is distinct from p_session_id or a.storage_path is distinct from p_storage_path or
       a.mime_type is distinct from p_mime_type or a.byte_length is distinct from p_byte_length or a.duration_ms is distinct from p_duration_ms or a.sha256 is distinct from p_sha256 then
      raise exception 'Conflicting audio' using errcode='23505';
    end if;
    return a.verified;
  end if;
  insert into experiment_audio(recording_id,uid,session_id,storage_path,mime_type,byte_length,duration_ms,sha256)
    values(p_recording_id,p_uid,p_session_id,p_storage_path,p_mime_type,p_byte_length,p_duration_ms,p_sha256);
  return false;
end;
$$;

create or replace function confirm_experiment_audio(p_uid text,p_session_id uuid,p_secret_hash text,p_recording_id uuid)
returns void language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_uid,0));
  if not exists(select 1 from experiment_sessions where uid=p_uid and session_id=p_session_id and
      session_secret_hash=p_secret_hash and completed_at is null) then
    raise exception 'Invalid audio session' using errcode='42501';
  end if;
  update experiment_audio set verified=true,verified_at=coalesce(verified_at,now())
    where uid=p_uid and session_id=p_session_id and recording_id=p_recording_id;
  if not found then raise exception 'Audio not prepared' using errcode='23514'; end if;
end;
$$;

create or replace function submit_experiment_v3(p_payload jsonb,p_payload_hash text,p_completion_code text,p_secret_hash text)
returns text language plpgsql as $$
declare s experiment_sessions%rowtype; a experiment_audio%rowtype; code text; voice jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_payload->>'uid',0));
  select * into s from experiment_sessions where uid=p_payload->>'uid' for update;
  if not found or s.session_secret_hash is null or s.session_secret_hash is distinct from p_secret_hash or
     s.questionnaire_version is distinct from '2026-11-21-v2' or p_payload->>'questionnaireVersion' is distinct from s.questionnaire_version then
    raise exception 'Invalid questionnaire session' using errcode='42501';
  end if;
  if jsonb_typeof(p_payload->'recognition') is distinct from 'object' or
     jsonb_typeof(p_payload->'explanation') is distinct from 'object' or jsonb_typeof(p_payload->'reasons') is distinct from 'object' then
    raise exception 'Post tasks missing' using errcode='23514';
  end if;
  voice := p_payload->'explanation'->'audio';
  if voice->>'state' = 'uploaded' then
    select * into a from experiment_audio where recording_id=(voice->>'recordingId')::uuid;
    if not found or not a.verified or a.uid is distinct from s.uid or a.session_id is distinct from s.session_id or
       a.storage_path is distinct from voice->>'storagePath' or a.sha256 is distinct from voice->>'sha256' or
       a.mime_type is distinct from voice->>'mimeType' or a.byte_length is distinct from (voice->>'byteLength')::integer or
       a.duration_ms is distinct from (voice->>'durationMs')::integer then
      raise exception 'Audio not verified' using errcode='23514';
    end if;
  elsif coalesce((p_payload->'explanation'->>'effectiveCharCount')::integer,0) < 20 then
    raise exception 'Explanation incomplete' using errcode='23514';
  end if;
  if coalesce((p_payload->'explanation'->>'effectiveCharCount')::integer,0) < 20 and coalesce((voice->>'durationMs')::integer,0) < 20000 then
    raise exception 'Explanation incomplete' using errcode='23514';
  end if;
  code := submit_experiment_v2(p_payload,p_payload_hash,p_completion_code);
  update experiment_sessions set recognition=p_payload->'recognition',explanation=p_payload->'explanation',
    reasons=p_payload->'reasons',presented_posts=p_payload->'presentedPosts',interruptions=p_payload->'interruptions'
    where uid=s.uid;
  return code;
end;
$$;

revoke all on function save_experiment_pretest_v3(text,uuid,integer,text,text,jsonb,text) from public,anon,authenticated;
revoke all on function prepare_experiment_audio(text,uuid,text,uuid,text,text,integer,integer,text) from public,anon,authenticated;
revoke all on function confirm_experiment_audio(text,uuid,text,uuid) from public,anon,authenticated;
revoke all on function submit_experiment_v3(jsonb,text,text,text) from public,anon,authenticated;
grant execute on function save_experiment_pretest_v3(text,uuid,integer,text,text,jsonb,text) to service_role;
grant execute on function prepare_experiment_audio(text,uuid,text,uuid,text,text,integer,integer,text) to service_role;
grant execute on function confirm_experiment_audio(text,uuid,text,uuid) to service_role;
grant execute on function submit_experiment_v3(jsonb,text,text,text) to service_role;
commit;

-- Masonry protocol v3 extension
-- Apply after the existing v1/v2 questionnaire and private-audio migrations.
-- Additive only: old data, scoring, RPCs, and in-progress sessions remain available.
begin;
alter table experiment_sessions add column if not exists rules jsonb;
alter table experiment_sessions add column if not exists permission_check jsonb;
alter table experiment_sessions add column if not exists reading_metrics jsonb;
alter table experiment_sessions add column if not exists explanation_saved_at timestamptz;

create or replace function save_experiment_pretest_v4(
 p_uid text,p_session_id uuid,p_condition_n integer,p_topic_key text,p_questionnaire_version text,p_pretest jsonb,p_secret_hash text,p_permission_check jsonb
) returns void language plpgsql as $$
declare s experiment_sessions%rowtype;
begin
 if p_questionnaire_version is distinct from '2026-11-21-v3' or p_secret_hash is null or p_secret_hash !~ '^[a-f0-9]{64}$' or jsonb_typeof(p_permission_check) is distinct from 'object' then
  raise exception 'Invalid session' using errcode='23514';
 end if;
 perform save_experiment_pretest(p_uid,p_session_id,p_condition_n,p_topic_key,p_questionnaire_version,p_pretest);
 select * into s from experiment_sessions where uid=p_uid for update;
 if s.session_secret_hash is not null and s.session_secret_hash is distinct from p_secret_hash then raise exception 'Conflicting secret' using errcode='23505'; end if;
 update experiment_sessions set session_secret_hash=p_secret_hash,permission_check=p_permission_check where uid=p_uid;
end;
$$;

create or replace function check_experiment_explanation_v4(p_uid text,p_session_id uuid,p_explanation jsonb)
returns void language plpgsql as $$
declare voice jsonb; a experiment_audio%rowtype; chars integer;
begin
 if jsonb_typeof(p_explanation) is distinct from 'object' or p_explanation->>'completedAt' is null then raise exception 'Explanation missing' using errcode='23514'; end if;
 chars:=coalesce((p_explanation->>'effectiveCharCount')::integer,0);
 voice:=p_explanation->'audio';
 if voice is not null and voice<>'null'::jsonb then
  if voice->>'state' is distinct from 'uploaded' then raise exception 'Audio must be saved or deleted' using errcode='23514'; end if;
  select * into a from experiment_audio where recording_id=(voice->>'recordingId')::uuid;
  if not found or not a.verified or a.uid is distinct from p_uid or a.session_id is distinct from p_session_id or
   a.storage_path is distinct from voice->>'storagePath' or a.mime_type is distinct from voice->>'mimeType' or a.sha256 is distinct from voice->>'sha256' or
   a.byte_length is distinct from (voice->>'byteLength')::integer or a.duration_ms is distinct from (voice->>'durationMs')::integer then
   raise exception 'Audio not verified' using errcode='23514';
  end if;
  if chars<20 and a.duration_ms<20000 then raise exception 'Explanation incomplete' using errcode='23514'; end if;
 elsif chars<20 then raise exception 'Explanation incomplete' using errcode='23514'; end if;
end;
$$;

create or replace function save_experiment_explanation_v4(p_uid text,p_session_id uuid,p_secret_hash text,p_explanation jsonb)
returns void language plpgsql as $$
declare s experiment_sessions%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_uid,0));
 select * into s from experiment_sessions where uid=p_uid for update;
 if not found or s.session_id is distinct from p_session_id or s.session_secret_hash is null or s.session_secret_hash is distinct from p_secret_hash or
  s.questionnaire_version is distinct from '2026-11-21-v3' or s.completed_at is not null then raise exception 'Invalid session' using errcode='42501'; end if;
 perform check_experiment_explanation_v4(p_uid,p_session_id,p_explanation);
 -- A timed-out older request must not overwrite a newer retry.
 if s.explanation_saved_at is not null and (s.explanation->>'completedAt')::bigint > (p_explanation->>'completedAt')::bigint then return; end if;
 update experiment_sessions set explanation=p_explanation,explanation_saved_at=now() where uid=p_uid;
end;
$$;

create or replace function submit_experiment_v4(p_payload jsonb,p_payload_hash text,p_completion_code text,p_secret_hash text)
returns text language plpgsql as $$
declare s experiment_sessions%rowtype; code text;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_payload->>'uid',0));
 select * into s from experiment_sessions where uid=p_payload->>'uid' for update;
 if not found or s.session_id::text is distinct from p_payload->>'sessionId' or s.session_secret_hash is null or s.session_secret_hash is distinct from p_secret_hash or
  s.questionnaire_version is distinct from '2026-11-21-v3' or p_payload->>'questionnaireVersion' is distinct from s.questionnaire_version then raise exception 'Invalid session' using errcode='42501'; end if;
 if s.explanation_saved_at is null or s.explanation is distinct from p_payload->'explanation' then raise exception 'Save explanation first' using errcode='23514'; end if;
 if jsonb_typeof(p_payload->'recognition') is distinct from 'object' or jsonb_typeof(p_payload->'reasons') is distinct from 'object' or
  jsonb_typeof(p_payload->'rules') is distinct from 'object' or jsonb_typeof(p_payload->'readingMetrics') is distinct from 'object' then raise exception 'Protocol data missing' using errcode='23514'; end if;
 perform check_experiment_explanation_v4(s.uid,s.session_id,p_payload->'explanation');
 code:=submit_experiment_v2(p_payload,p_payload_hash,p_completion_code);
 update experiment_sessions set recognition=p_payload->'recognition',explanation=p_payload->'explanation',reasons=p_payload->'reasons',presented_posts=p_payload->'presentedPosts',interruptions=p_payload->'interruptions',rules=p_payload->'rules',permission_check=p_payload->'microphonePermission',reading_metrics=p_payload->'readingMetrics' where uid=s.uid;
 return code;
end;
$$;
revoke all on function save_experiment_pretest_v4(text,uuid,integer,text,text,jsonb,text,jsonb) from public,anon,authenticated;
revoke all on function check_experiment_explanation_v4(text,uuid,jsonb) from public,anon,authenticated;
revoke all on function save_experiment_explanation_v4(text,uuid,text,jsonb) from public,anon,authenticated;
revoke all on function submit_experiment_v4(jsonb,text,text,text) from public,anon,authenticated;
grant execute on function save_experiment_pretest_v4(text,uuid,integer,text,text,jsonb,text,jsonb) to service_role;
grant execute on function check_experiment_explanation_v4(text,uuid,jsonb) to service_role;
grant execute on function save_experiment_explanation_v4(text,uuid,text,jsonb) to service_role;
grant execute on function submit_experiment_v4(jsonb,text,text,text) to service_role;
notify pgrst,'reload schema';
commit;

-- Additive reasons protocol. Run after release-v3-20261121.sql. Existing versions/RPCs remain unchanged.
begin;
alter table experiment_sessions add column if not exists pre_reasons jsonb;
alter table experiment_sessions add column if not exists post_reasons jsonb;
alter table experiment_sessions add column if not exists interaction_comparison jsonb;
create or replace function save_experiment_pretest_v5(
 p_uid text,p_session_id uuid,p_condition_n integer,p_topic_key text,p_questionnaire_version text,p_pretest jsonb,p_secret_hash text,p_permission_check jsonb,p_pre_reasons jsonb
) returns void language plpgsql as $$
declare s experiment_sessions%rowtype;
begin
 if p_questionnaire_version is distinct from '2026-11-23-reasons-v1' or p_secret_hash is null or p_secret_hash !~ '^[a-f0-9]{64}$' or jsonb_typeof(p_permission_check) is distinct from 'object' or jsonb_typeof(p_pre_reasons) is distinct from 'object' or p_pre_reasons->>'completedAt' is null then
  raise exception 'Invalid session' using errcode='23514';
 end if;
 perform save_experiment_pretest(p_uid,p_session_id,p_condition_n,p_topic_key,p_questionnaire_version,p_pretest);
 select * into s from experiment_sessions where uid=p_uid for update;
 if s.session_secret_hash is not null and s.session_secret_hash is distinct from p_secret_hash then raise exception 'Conflicting secret' using errcode='23505'; end if;
 if s.pre_reasons is not null and s.pre_reasons is distinct from p_pre_reasons then raise exception 'Conflicting pre reasons' using errcode='23505'; end if;
 update experiment_sessions set session_secret_hash=p_secret_hash,permission_check=p_permission_check,pre_reasons=p_pre_reasons where uid=p_uid;
end;
$$;

create or replace function save_experiment_explanation_v5(p_uid text,p_session_id uuid,p_secret_hash text,p_explanation jsonb)
returns void language plpgsql as $$
declare s experiment_sessions%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_uid,0));
 select * into s from experiment_sessions where uid=p_uid for update;
 if not found or s.session_id is distinct from p_session_id or s.session_secret_hash is null or s.session_secret_hash is distinct from p_secret_hash or
  s.questionnaire_version is distinct from '2026-11-23-reasons-v1' or s.completed_at is not null then raise exception 'Invalid session' using errcode='42501'; end if;
 perform check_experiment_explanation_v4(p_uid,p_session_id,p_explanation);
 -- A timed-out older request must not overwrite a newer retry.
 if s.explanation_saved_at is not null and (s.explanation->>'completedAt')::bigint > (p_explanation->>'completedAt')::bigint then return; end if;
 update experiment_sessions set explanation=p_explanation,explanation_saved_at=now() where uid=p_uid;
end;
$$;

create or replace function submit_experiment_v5(p_payload jsonb,p_payload_hash text,p_completion_code text,p_secret_hash text)
returns text language plpgsql as $$
declare s experiment_sessions%rowtype; code text;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_payload->>'uid',0));
 select * into s from experiment_sessions where uid=p_payload->>'uid' for update;
 if not found or s.session_id::text is distinct from p_payload->>'sessionId' or s.session_secret_hash is null or s.session_secret_hash is distinct from p_secret_hash or
  s.questionnaire_version is distinct from '2026-11-23-reasons-v1' or p_payload->>'questionnaireVersion' is distinct from s.questionnaire_version then raise exception 'Invalid session' using errcode='42501'; end if;
 if s.explanation_saved_at is null or s.explanation is distinct from p_payload->'explanation' then raise exception 'Save explanation first' using errcode='23514'; end if;
 if jsonb_typeof(p_payload->'recognition') is distinct from 'object' or jsonb_typeof(p_payload->'postReasons') is distinct from 'object' or jsonb_typeof(p_payload->'interactionComparison') is distinct from 'object' or p_payload->'postReasons'->>'completedAt' is null or p_payload->'interactionComparison'->>'completedAt' is null or s.pre_reasons is null or s.pre_reasons is distinct from p_payload->'preReasons' or
  jsonb_typeof(p_payload->'rules') is distinct from 'object' or jsonb_typeof(p_payload->'readingMetrics') is distinct from 'object' then raise exception 'Protocol data missing' using errcode='23514'; end if;
 perform check_experiment_explanation_v4(s.uid,s.session_id,p_payload->'explanation');
 code:=submit_experiment_v2(p_payload,p_payload_hash,p_completion_code);
 update experiment_sessions set recognition=p_payload->'recognition',explanation=p_payload->'explanation',reasons=null,post_reasons=p_payload->'postReasons',interaction_comparison=p_payload->'interactionComparison',presented_posts=p_payload->'presentedPosts',interruptions=p_payload->'interruptions',rules=p_payload->'rules',permission_check=p_payload->'microphonePermission',reading_metrics=p_payload->'readingMetrics' where uid=s.uid;
 return code;
end;
$$;
revoke all on function save_experiment_pretest_v5(text,uuid,integer,text,text,jsonb,text,jsonb,jsonb) from public,anon,authenticated;
revoke all on function save_experiment_explanation_v5(text,uuid,text,jsonb) from public,anon,authenticated;
revoke all on function submit_experiment_v5(jsonb,text,text,text) from public,anon,authenticated;
grant execute on function save_experiment_pretest_v5(text,uuid,integer,text,text,jsonb,text,jsonb,jsonb) to service_role;
grant execute on function save_experiment_explanation_v5(text,uuid,text,jsonb) to service_role;
grant execute on function submit_experiment_v5(jsonb,text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
