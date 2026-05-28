-- Run in Supabase SQL Editor if "Hotové" fails with RLS error.
alter table public.requests drop constraint if exists requests_status_check;

alter table public.requests add constraint requests_status_check
  check (status in ('inquiry', 'waiting', 'done', 'completed'));

drop policy if exists "Allow anon update request status" on public.requests;

create policy "Allow anon update request status"
  on public.requests
  for update
  to anon
  using (true)
  with check (status in ('inquiry', 'waiting', 'done', 'completed'));

drop policy if exists "Allow anon insert requests" on public.requests;

create policy "Allow anon insert requests"
  on public.requests
  for insert
  to anon
  with check (true);
