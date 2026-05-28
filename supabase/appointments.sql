-- Supabase schema for cAsker appointments
-- Requires public.requests from supabase/requests.sql.
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  request_id text references public.requests(id),
  customer_name text not null,
  vehicle_info text not null,
  appointment_date date not null,
  appointment_time time not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  message text,
  created_at timestamptz not null default now()
);

alter table public.appointments
  add column if not exists request_id text references public.requests(id);

alter table public.appointments
  add column if not exists message text;

create index if not exists appointments_status_date_idx
  on public.appointments (status, appointment_date, appointment_time);

alter table public.appointments enable row level security;

create policy "Allow anon read accepted appointments"
  on public.appointments
  for select
  to anon
  using (status = 'accepted');

create policy "Allow anon insert pending appointments"
  on public.appointments
  for insert
  to anon
  with check (status = 'pending');

create policy "Allow anon read pending appointments"
  on public.appointments
  for select
  to anon
  using (status = 'pending');

drop policy if exists "Allow anon update appointment status" on public.appointments;

create policy "Allow anon update appointment status"
  on public.appointments
  for update
  to anon
  using (status in ('pending', 'accepted'))
  with check (status in ('pending', 'accepted', 'rejected'));

alter table public.appointments replica identity full;

alter publication supabase_realtime add table public.appointments;

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
  '2',
  'Mária Kováčová',
  'VW Golf 2016 - EC-ZA123AB',
  date '2026-05-27',
  time '09:30:00',
  'pending',
  'Navrhujeme diagnostiku motora dňa 27.5. o 9:30. Prosím o potvrdenie termínu.'
where not exists (
  select 1
  from public.appointments
  where request_id = '2' and status = 'pending'
);
