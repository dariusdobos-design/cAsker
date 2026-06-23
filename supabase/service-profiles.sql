-- Verejný profil servisu (ako "facebooková stránka" firmy):
-- logo/fotka prevádzky, popis a zoznam ponúkaných služieb.
-- Spustite raz v Supabase SQL editore.

create table if not exists public.service_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default '',
  about text not null default '',
  services text[] not null default '{}',
  logo_data_url text,
  posts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_profiles_user_id_key unique (user_id)
);

-- Pre existujúce inštalácie: príspevky s fotkami (popis + fotky).
alter table public.service_profiles
  add column if not exists posts jsonb not null default '[]'::jsonb;

create index if not exists service_profiles_user_id_idx on public.service_profiles (user_id);

alter table public.service_profiles enable row level security;

drop policy if exists "Users read own service profile" on public.service_profiles;
drop policy if exists "Users insert own service profile" on public.service_profiles;
drop policy if exists "Users update own service profile" on public.service_profiles;
drop policy if exists "Anon read service profiles" on public.service_profiles;

-- Zákaznícka apka číta profily servisov (verejná vizitka).
create policy "Anon read service profiles"
  on public.service_profiles
  for select
  to anon
  using (true);

grant select on table public.service_profiles to anon;

create policy "Users read own service profile"
  on public.service_profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users insert own service profile"
  on public.service_profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users update own service profile"
  on public.service_profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on table public.service_profiles to authenticated;

create or replace function public.set_service_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists service_profiles_set_updated_at on public.service_profiles;

create trigger service_profiles_set_updated_at
  before update on public.service_profiles
  for each row
  execute function public.set_service_profiles_updated_at();
