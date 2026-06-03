-- Run in Supabase SQL Editor to enable cancelling and restoring requests.
alter table public.requests
  add column if not exists status_before_cancel text
  check (status_before_cancel is null or status_before_cancel in ('inquiry', 'waiting', 'done'));

alter table public.requests drop constraint if exists requests_status_check;

alter table public.requests add constraint requests_status_check
  check (status in ('inquiry', 'waiting', 'done', 'completed', 'cancelled'));

drop policy if exists "Allow anon update request status" on public.requests;

create policy "Allow anon update request status"
  on public.requests
  for update
  to anon
  using (true)
  with check (status in ('inquiry', 'waiting', 'done', 'completed', 'cancelled'));
