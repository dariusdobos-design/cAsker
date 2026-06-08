-- Notifikácia pre servis, keď zákazník v apke prijme navrhovaný termín.
alter table public.requests
  add column if not exists customer_accepted_at timestamptz;

alter table public.requests
  add column if not exists service_accepted_seen_at timestamptz;
