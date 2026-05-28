-- Remove orphan test appointments that have no linked request in cAsker.
delete from public.appointments
where request_id is null
  and customer_name in ('Test', 'Test2');
