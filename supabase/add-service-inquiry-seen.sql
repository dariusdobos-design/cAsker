-- Notifikácia pre servis, keď príde nový dopyt do sekcie Dopyt.
alter table public.requests
  add column if not exists service_inquiry_seen_at timestamptz;
