-- Run in Supabase SQL Editor.
-- Stores completed work description and customer notification log.

alter table public.requests
  add column if not exists completed_work text;

create table if not exists public.customer_notifications (
  id uuid primary key default gen_random_uuid(),
  request_id text not null,
  customer_name text not null,
  customer_phone text,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.customer_notifications enable row level security;

drop policy if exists "Allow anon insert customer notifications" on public.customer_notifications;
drop policy if exists "Allow anon read customer notifications" on public.customer_notifications;

create policy "Allow anon insert customer notifications"
  on public.customer_notifications
  for insert
  to anon
  with check (true);

create policy "Allow anon read customer notifications"
  on public.customer_notifications
  for select
  to anon
  using (true);
