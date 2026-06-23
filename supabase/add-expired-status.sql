-- Run in Supabase SQL Editor to support nightly expiration of unanswered inquiries.
-- Extends status check so unanswered dopyty can be moved to "expired".

alter table public.requests drop constraint if exists requests_status_check;

alter table public.requests add constraint requests_status_check
  check (status in ('inquiry', 'waiting', 'done', 'completed', 'cancelled', 'expired'));

drop policy if exists "Allow anon update request status" on public.requests;

create policy "Allow anon update request status"
  on public.requests
  for update
  to anon
  using (true)
  with check (status in ('inquiry', 'waiting', 'done', 'completed', 'cancelled', 'expired'));
