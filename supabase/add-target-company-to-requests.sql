-- Priamy dopyt z mobilnej mapy na konkrétnu firmu (servis / autodiely / …).
-- NULL = bežný dopyt do okolia (broadcast).

alter table public.requests
  add column if not exists target_company_id uuid references public.companies (id) on delete set null;

create index if not exists requests_target_company_id_idx
  on public.requests (target_company_id);
