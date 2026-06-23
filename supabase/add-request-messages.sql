-- Chat správy medzi servisom a zákazníkom (jeden thread na request_id).
create table if not exists public.request_messages (
  id uuid primary key default gen_random_uuid(),
  request_id text not null references public.requests(id) on delete cascade,
  sender_role text not null check (sender_role in ('service', 'customer')),
  body text not null check (char_length(trim(body)) > 0),
  customer_read_at timestamptz,
  service_read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists request_messages_request_id_created_at_idx
  on public.request_messages (request_id, created_at);

create index if not exists request_messages_customer_unread_idx
  on public.request_messages (request_id)
  where sender_role = 'service' and customer_read_at is null;

create index if not exists request_messages_service_unread_idx
  on public.request_messages (request_id)
  where sender_role = 'customer' and service_read_at is null;

alter table public.request_messages enable row level security;

create policy "Allow anon read request messages"
  on public.request_messages
  for select
  to anon
  using (true);

create policy "Allow anon insert request messages"
  on public.request_messages
  for insert
  to anon
  with check (sender_role in ('service', 'customer'));

create policy "Allow anon update request messages read state"
  on public.request_messages
  for update
  to anon
  using (true)
  with check (true);

alter publication supabase_realtime add table public.request_messages;
