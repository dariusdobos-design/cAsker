-- Kedy môže zákazník prevziať vozidlo (pri označení dopytu ako hotové)
alter table public.requests
  add column if not exists vehicle_pickup_note text;
