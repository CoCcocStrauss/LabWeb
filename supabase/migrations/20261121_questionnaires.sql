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
