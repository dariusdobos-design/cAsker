-- Run this once in Supabase SQL editor if reschedule / proposal save fails with RLS error.

-- appointment_proposals (chat history of sent terms)
grant select, insert on table public.appointment_proposals to anon;

alter table public.appointment_proposals enable row level security;

drop policy if exists "Allow anon read appointment proposals" on public.appointment_proposals;
drop policy if exists "Allow anon insert appointment proposals" on public.appointment_proposals;

create policy "Allow anon read appointment proposals"
  on public.appointment_proposals
  for select
  to anon
  using (true);

create policy "Allow anon insert appointment proposals"
  on public.appointment_proposals
  for insert
  to anon
  with check (true);

-- appointments (update pending term when service reschedules)
grant update on table public.appointments to anon;

drop policy if exists "Allow anon update appointment status" on public.appointments;

create policy "Allow anon update appointment status"
  on public.appointments
  for update
  to anon
  using (status in ('pending', 'accepted'))
  with check (status in ('pending', 'accepted', 'rejected'));
