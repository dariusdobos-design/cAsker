-- History of service appointment proposals shown in "Popis dopytu".
create table if not exists public.appointment_proposals (
  id uuid primary key default gen_random_uuid(),
  request_id text not null references public.requests(id) on delete cascade,
  appointment_date date not null,
  appointment_time time not null,
  message text,
  sent_at timestamptz not null default now(),
  proposal_kind text not null default 'initial'
    check (proposal_kind in ('initial', 'counter'))
);

create index if not exists appointment_proposals_request_sent_idx
  on public.appointment_proposals (request_id, sent_at);

alter table public.appointment_proposals enable row level security;

grant select, insert on table public.appointment_proposals to anon;

drop policy if exists "Allow anon read appointment proposals" on public.appointment_proposals;
drop policy if exists "Allow anon insert appointment proposals" on public.appointment_proposals;

create policy "Allow anon read appointment proposals"
  on public.appointment_proposals
  for select
  to anon
  using (true);

create policy "Allow anon insert appointment proposals"
  on public.appointment_proposals
  for insert
  to anon
  with check (true);

alter table public.appointment_proposals replica identity full;
