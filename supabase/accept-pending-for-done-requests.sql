-- Confirm pending appointments for requests already marked as Prijaté (done).
update public.appointments
set status = 'accepted'
where status = 'pending'
  and request_id in (
    select id
    from public.requests
    where status = 'done'
  );

insert into public.appointments (
  request_id,
  customer_name,
  vehicle_info,
  appointment_date,
  appointment_time,
  status,
  message
)
select
  '15',
  'Silvia Hrušková',
  'VW Crafter 2019 - EC-KI778VC',
  date '2026-05-30',
  time '08:00:00',
  'accepted',
  'Diagnostika motora je potvrdená na 30.5. o 8:00.'
where not exists (
  select 1
  from public.appointments
  where request_id = '15'
    and status in ('pending', 'accepted')
);

drop policy if exists "Allow anon update appointment status" on public.appointments;

create policy "Allow anon update appointment status"
  on public.appointments
  for update
  to anon
  using (status in ('pending', 'accepted'))
  with check (status in ('pending', 'accepted', 'rejected'));
