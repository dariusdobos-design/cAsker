-- Customer requested a different appointment time (stored on the request).
alter table public.requests
  add column if not exists reschedule_requested_at timestamptz;
