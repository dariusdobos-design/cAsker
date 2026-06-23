-- Spusti v Supabase SQL editore, ak už existuje tabuľka request_messages
-- ale realtime notifikácie na chat ešte nefungujú.
alter publication supabase_realtime add table public.request_messages;
