-- Allow rescheduling accepted appointments back to pending.
drop policy if exists "Allow anon update appointment status" on public.appointments;

create policy "Allow anon update appointment status"
  on public.appointments
  for update
  to anon
  using (status in ('pending', 'accepted'))
  with check (status in ('pending', 'accepted', 'rejected'));
