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
