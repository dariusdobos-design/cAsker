-- Company profiles linked to Supabase Auth users.
-- Run once in Supabase SQL editor after enabling Email auth.

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  phone text not null default '',
  ico text not null default '',
  company_name text not null default '',
  billing_street text not null default '',
  billing_city text not null default '',
  billing_zip text not null default '',
  dic text not null default '',
  ic_dph text not null default '',
  operation_street text not null default '',
  operation_city text not null default '',
  operation_zip text not null default '',
  has_premium boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_user_id_key unique (user_id)
);

create index if not exists companies_user_id_idx on public.companies (user_id);

alter table public.companies enable row level security;

drop policy if exists "Users read own company" on public.companies;
drop policy if exists "Users insert own company" on public.companies;
drop policy if exists "Users update own company" on public.companies;

create policy "Users read own company"
  on public.companies
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users insert own company"
  on public.companies
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users update own company"
  on public.companies
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on table public.companies to authenticated;

create or replace function public.set_companies_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists companies_set_updated_at on public.companies;

create trigger companies_set_updated_at
  before update on public.companies
  for each row
  execute function public.set_companies_updated_at();
