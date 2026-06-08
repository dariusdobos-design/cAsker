-- Umožní zákazníckej apke načítať polohy registrovaných servisov na mape.
grant select on table public.companies to anon;

drop policy if exists "Allow anon read companies for map" on public.companies;

create policy "Allow anon read companies for map"
  on public.companies
  for select
  to anon
  using (
    trim(coalesce(company_name, '')) <> ''
    and (
      trim(coalesce(operation_city, '')) <> ''
      or trim(coalesce(billing_city, '')) <> ''
    )
  );
