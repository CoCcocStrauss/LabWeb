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
