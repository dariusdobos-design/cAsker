-- Typ dopytu: auto | tire | towing
-- Zákazník vždy zvolí kategóriu pri zadávaní — v DB nie je DEFAULT pre nové riadky.

alter table public.requests
  add column if not exists request_category text;

-- Jednorazovo: staré testovacie dopyty pred touto funkciou (nie „predvolená kategória“ pre nové).
update public.requests
  set request_category = 'auto'
  where request_category is null;

alter table public.requests
  alter column request_category set not null;

alter table public.requests
  alter column request_category drop default;

alter table public.requests drop constraint if exists requests_request_category_check;

alter table public.requests add constraint requests_request_category_check
  check (request_category in ('auto', 'tire', 'towing'));

create index if not exists requests_request_category_idx
  on public.requests (request_category);
