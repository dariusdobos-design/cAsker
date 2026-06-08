-- Run in Supabase SQL Editor to remove every customer request and related data.
-- Dashboard and mobile app will show no inquiries after this.

delete from public.customer_notifications;

delete from public.appointment_proposals;

delete from public.appointments;

delete from public.requests;
