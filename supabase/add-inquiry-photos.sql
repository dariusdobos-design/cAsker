-- Fotky priložené k dopytu z mobilnej appky (data URL reťazce v JSON poli).
alter table public.requests
  add column if not exists inquiry_photos jsonb not null default '[]'::jsonb;
