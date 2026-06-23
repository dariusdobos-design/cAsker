-- Run in Supabase SQL Editor to remove every customer request and related data.
-- Dashboard and mobile app will show no inquiries after this.
-- Do NOT re-run supabase/requests.sql afterward (it inserts demo rows).

delete from public.request_messages;
delete from public.customer_notifications;
delete from public.appointment_proposals;
delete from public.appointments;
delete from public.requests;

-- Verify (should return 0):
-- select count(*) from public.requests;
