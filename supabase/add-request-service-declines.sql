-- Servis môže odmietnuť dopyt len pre seba (nezmizne zákazníkovi, kým ho neprijme iný servis).
create table if not exists public.request_service_declines (
  request_id text not null references public.requests (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  declined_at timestamptz not null default now(),
  primary key (request_id, company_id)
);

create index if not exists request_service_declines_company_id_idx
  on public.request_service_declines (company_id);

alter table public.request_service_declines enable row level security;

drop policy if exists "Allow anon read request service declines" on public.request_service_declines;
create policy "Allow anon read request service declines"
  on public.request_service_declines
  for select
  to anon
  using (true);

drop policy if exists "Allow anon insert request service declines" on public.request_service_declines;
create policy "Allow anon insert request service declines"
  on public.request_service_declines
  for insert
  to anon
  with check (true);

alter table public.requests
  add column if not exists cancel_reason text
  check (cancel_reason is null or cancel_reason in ('customer', 'no_service_accepted'));
