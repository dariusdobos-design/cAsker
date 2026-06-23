-- Zákazník potvrdí prevzatie vozidla v appke; dopyt sa presunie do História.
alter table public.requests
  add column if not exists customer_pickup_confirmed_at timestamptz;
