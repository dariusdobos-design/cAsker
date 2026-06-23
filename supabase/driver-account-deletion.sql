create table if not exists public.driver_account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  user_name text not null,
  phone text,
  cancel_token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'cancelled', 'completed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  cancelled_at timestamptz
);

create index if not exists driver_account_deletion_requests_email_idx
  on public.driver_account_deletion_requests (lower(email));

create index if not exists driver_account_deletion_requests_token_idx
  on public.driver_account_deletion_requests (cancel_token);
