-- Run in Supabase SQL Editor if rejecting an offer from the mobile app fails.
-- Fixes: update permission + read access to already-rejected rows (retry/idempotency).

grant update on table public.appointments to anon;

drop policy if exists "Allow anon read rejected appointments" on public.appointments;

create policy "Allow anon read rejected appointments"
  on public.appointments
  for select
  to anon
  using (status = 'rejected');

drop policy if exists "Allow anon update appointment status" on public.appointments;

create policy "Allow anon update appointment status"
  on public.appointments
  for update
  to anon
  using (status in ('pending', 'accepted'))
  with check (status in ('pending', 'accepted', 'rejected'));

-- Optional one-time repair: dopyt uviazol v Čaká, ale všetky ponuky sú už rejected.
update public.requests r
set
  status = 'inquiry',
  updated_at = now(),
  reschedule_requested_at = null
where r.status in ('waiting', 'done')
  and not exists (
    select 1
    from public.appointments a
    where a.request_id = r.id
      and a.status in ('pending', 'accepted')
  );
