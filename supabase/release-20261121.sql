-- Manual release migration: run in the existing LabWeb Supabase SQL Editor.
-- Combined from the three versioned migration files; preserves existing data.
begin;

-- 增量迁移：保留现有四表、旧记录及14参数提交函数。
-- 本文件只准备，未自动执行；在发布新代码前由实验负责人执行。

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

-- 在20261121_questionnaires.sql之后执行。仅准备，未执行线上迁移。

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

-- 仅在Supabase项目中执行；先执行前两份应用表迁移。未自动执行线上配置。

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('experiment-audio','experiment-audio',false,20971520,array['audio/webm','audio/mp4','audio/ogg'])
on conflict(id) do nothing;
do $$ begin
  if exists(select 1 from storage.buckets where id='experiment-audio' and public) then
    raise exception 'experiment-audio must be private; review existing bucket configuration';
  end if;
end $$;
-- 即使项目已有宽泛的对象读取policy，也禁止anon/authenticated访问研究录音。
drop policy if exists labweb_audio_private on storage.objects;
create policy labweb_audio_private on storage.objects as restrictive for all to anon,authenticated
  using (bucket_id <> 'experiment-audio') with check (bucket_id <> 'experiment-audio');

notify pgrst, 'reload schema';
commit;

select to_regclass('public.experiment_sessions') as sessions_table,
       to_regclass('public.experiment_audio') as audio_table,
       (select not public from storage.buckets where id = 'experiment-audio') as audio_bucket_private;
