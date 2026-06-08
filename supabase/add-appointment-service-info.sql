alter table public.appointments
  add column if not exists company_name text;

alter table public.appointments
  add column if not exists service_address text;

alter table public.appointments
  add column if not exists service_city text;

alter table public.appointments
  add column if not exists service_zip text;
