-- Read-only deployment checks. Execute after release-materials-20261125.sql.
select p.proname,
       has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
 ('save_experiment_pretest_v7','save_experiment_explanation_v7','submit_experiment_v7')
order by p.proname;

select questionnaire_version, topic_key, count(*) as session_count,
       count(*) filter(where completed_at is not null) as completed_count
from experiment_sessions
group by questionnaire_version, topic_key
order by questionnaire_version, topic_key;

-- New QA sessions only; no audio URLs, secrets or explanation content.
select s.uid, s.questionnaire_version, s.topic_key, s.completed_at,
       jsonb_array_length(coalesce(s.reading_metrics->'detailIntervals','[]'::jsonb)) as detail_interval_count,
       jsonb_array_length(coalesce(s.blinded_post_evaluations->'answers','[]'::jsonb)) as blind_answer_count,
       jsonb_array_length(coalesce(s.presented_posts,'[]'::jsonb)) as post_count,
       (select count(*) from actions a where a.uid=s.uid) as action_count,
       (select count(*) from post_visibility v where v.uid=s.uid) as preview_visibility_count
from experiment_sessions s
where s.uid like 'test\_%' escape '\' and s.questionnaire_version='2026-11-25-v5'
order by s.created_at desc limit 20;
