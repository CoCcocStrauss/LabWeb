-- 新版 800 元补贴 / AI 医疗语料，版本隔离；保留 v6 函数与所有旧数据。
-- 仅新增 service_role RPC，无表结构或历史数据修改，可重复执行。
begin;
create or replace function save_experiment_pretest_v7(
 p_uid text,p_session_id uuid,p_condition_n integer,p_topic_key text,p_questionnaire_version text,p_pretest jsonb,p_secret_hash text,p_permission_check jsonb
) returns void language plpgsql as $$
declare s experiment_sessions%rowtype;
begin
 if p_questionnaire_version is distinct from '2026-11-25-v5' or p_secret_hash is null or p_secret_hash !~ '^[a-f0-9]{64}$' or jsonb_typeof(p_permission_check) is distinct from 'object' then
  raise exception 'Invalid session' using errcode='23514';
 end if;
 perform save_experiment_pretest(p_uid,p_session_id,p_condition_n,p_topic_key,p_questionnaire_version,p_pretest);
 select * into s from experiment_sessions where uid=p_uid for update;
 if s.session_secret_hash is not null and s.session_secret_hash is distinct from p_secret_hash then raise exception 'Conflicting secret' using errcode='23505'; end if;
 update experiment_sessions set session_secret_hash=p_secret_hash,permission_check=p_permission_check where uid=p_uid;
end;
$$;

create or replace function save_experiment_explanation_v7(p_uid text,p_session_id uuid,p_secret_hash text,p_explanation jsonb)
returns void language plpgsql as $$
declare s experiment_sessions%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_uid,0));
 select * into s from experiment_sessions where uid=p_uid for update;
 if not found or s.session_id is distinct from p_session_id or s.session_secret_hash is null or s.session_secret_hash is distinct from p_secret_hash or
  s.questionnaire_version is distinct from '2026-11-25-v5' or s.completed_at is not null then raise exception 'Invalid session' using errcode='42501'; end if;
 perform check_experiment_explanation_v4(p_uid,p_session_id,p_explanation);
 -- A timed-out older request must not overwrite a newer retry.
 if s.explanation_saved_at is not null and (s.explanation->>'completedAt')::bigint > (p_explanation->>'completedAt')::bigint then return; end if;
 update experiment_sessions set explanation=p_explanation,explanation_saved_at=now() where uid=p_uid;
end;
$$;

create or replace function submit_experiment_v7(p_payload jsonb,p_payload_hash text,p_completion_code text,p_secret_hash text)
returns text language plpgsql as $$
declare s experiment_sessions%rowtype; code text;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_payload->>'uid',0));
 select * into s from experiment_sessions where uid=p_payload->>'uid' for update;
 if not found or s.session_id::text is distinct from p_payload->>'sessionId' or s.session_secret_hash is null or s.session_secret_hash is distinct from p_secret_hash or
  s.questionnaire_version is distinct from '2026-11-25-v5' or p_payload->>'questionnaireVersion' is distinct from s.questionnaire_version then raise exception 'Invalid session' using errcode='42501'; end if;
 if s.explanation_saved_at is null or s.explanation is distinct from p_payload->'explanation' then raise exception 'Save explanation first' using errcode='23514'; end if;
 if jsonb_typeof(p_payload->'blindedPostEvaluations') is distinct from 'object' or p_payload->'blindedPostEvaluations'->>'completedAt' is null then raise exception 'Blind evaluations missing' using errcode='23514'; end if;
 if (p_payload->>'endTime')::bigint-(p_payload->>'startTime')::bigint>150000 or (p_payload->>'endReason'='timeout' and (p_payload->>'endTime')::bigint-(p_payload->>'startTime')::bigint<>150000) or (p_payload->>'endReason'='manual' and ((p_payload->>'endTime')::bigint-(p_payload->>'startTime')::bigint<100000 or (p_payload->>'finalShareCount')::int<2 or p_payload->>'unlockShownAtMs' is null)) then raise exception 'Invalid reading end' using errcode='23514'; end if;
 perform check_experiment_explanation_v4(s.uid,s.session_id,p_payload->'explanation');
 code:=submit_experiment_v2(p_payload,p_payload_hash,p_completion_code);
 update experiment_sessions set recognition=p_payload->'recognition',explanation=p_payload->'explanation',reasons=null,blinded_post_evaluations=p_payload->'blindedPostEvaluations',presented_posts=p_payload->'presentedPosts',interruptions=p_payload->'interruptions',rules=p_payload->'rules',permission_check=p_payload->'microphonePermission',reading_metrics=p_payload->'readingMetrics' where uid=s.uid;
 update experiments set met_share_goal=(p_payload->>'metShareGoal')::boolean,final_share_count=(p_payload->>'finalShareCount')::integer,unlock_shown_at_ms=(p_payload->>'unlockShownAtMs')::bigint where uid=s.uid;
 return code;
end;
$$;
revoke all on function save_experiment_pretest_v7(text,uuid,integer,text,text,jsonb,text,jsonb) from public,anon,authenticated;
revoke all on function save_experiment_explanation_v7(text,uuid,text,jsonb) from public,anon,authenticated;
revoke all on function submit_experiment_v7(jsonb,text,text,text) from public,anon,authenticated;
grant execute on function save_experiment_pretest_v7(text,uuid,integer,text,text,jsonb,text,jsonb) to service_role;
grant execute on function save_experiment_explanation_v7(text,uuid,text,jsonb) to service_role;
grant execute on function submit_experiment_v7(jsonb,text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
