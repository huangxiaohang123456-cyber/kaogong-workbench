-- =============================================================
-- 考公工作台 · 真账号权限隔离
-- Supabase 后台 → SQL Editor 粘贴全部 → Run
-- 作用：新建 kg_users 表，用 RLS 强制「每人只能读写自己那一行」
-- =============================================================

create table if not exists kg_users (
  user_id    text primary key,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

alter table kg_users enable row level security;

drop policy if exists "own_row" on kg_users;
create policy "own_row" on kg_users
  for all
  to authenticated
  using     ( auth.uid()::text = user_id )
  with check( auth.uid()::text = user_id );
