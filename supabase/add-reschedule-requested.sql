-- Customer requested a different appointment time (waiting / pending flow).
alter table public.appointments
  add column if not exists reschedule_requested_at timestamptz;
