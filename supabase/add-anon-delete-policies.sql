-- Temporary policies so cleanup scripts can purge test data via anon key.
-- Safe for dev; restrict in production if needed.

drop policy if exists "Allow anon delete customer notifications" on public.customer_notifications;
create policy "Allow anon delete customer notifications"
  on public.customer_notifications
  for delete
  to anon
  using (true);

drop policy if exists "Allow anon delete appointment proposals" on public.appointment_proposals;
create policy "Allow anon delete appointment proposals"
  on public.appointment_proposals
  for delete
  to anon
  using (true);

drop policy if exists "Allow anon delete appointments" on public.appointments;
create policy "Allow anon delete appointments"
  on public.appointments
  for delete
  to anon
  using (true);

drop policy if exists "Allow anon delete requests" on public.requests;
create policy "Allow anon delete requests"
  on public.requests
  for delete
  to anon
  using (true);
