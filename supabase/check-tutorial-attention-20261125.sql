-- 2026-11-25 三步教程与切屏提醒：无需 DDL / 数据迁移。
-- 沿用已经执行的 release-blinded-20261124.sql 和现有 JSONB 字段。
-- 本文件仅核验，不更新或删除数据；上线后将下方 UID 换成自己的 test_ UID。
begin transaction read only;

select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'experiment_sessions'
  and column_name in ('rules', 'interruptions', 'reading_metrics')
order by column_name;

select
  to_regprocedure('public.save_experiment_pretest_v6(text,uuid,integer,text,text,jsonb,text,jsonb)') is not null as pretest_v6_ready,
  to_regprocedure('public.save_experiment_explanation_v6(text,uuid,text,jsonb)') is not null as explanation_v6_ready,
  to_regprocedure('public.submit_experiment_v6(jsonb,text,text,text)') is not null as submit_v6_ready;

with target(uid) as (values ('test_tutorial_20261125_24_01'))
select s.uid, s.questionnaire_version, s.completed_at,
       s.rules ->> 'presentationVersion' as tutorial_version,
       s.rules -> 'items' as tutorial_steps,
       s.rules -> 'demoLabelSelections' as demo_label_selections,
       s.reading_metrics ->> 'attentionVersion' as attention_version,
       s.reading_metrics -> 'hiddenCount' as hidden_count,
       s.reading_metrics -> 'totalHiddenMs' as total_hidden_ms,
       s.reading_metrics -> 'detailIntervals' as detail_intervals,
       s.interruptions,
       (select count(*) from actions a where a.uid = s.uid and a.type = 'unshare') as unshare_count
from experiment_sessions s join target t on s.uid = t.uid;

commit;
