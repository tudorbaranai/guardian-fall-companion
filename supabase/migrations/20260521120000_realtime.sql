-- Guardian — enable Supabase Realtime on the live tables.
--
-- Without this the dashboard's realtime subscription connects but never
-- receives postgres_changes events. Apply via the Supabase CLI
-- (`supabase db push`) or paste into the SQL Editor → Run.

alter publication supabase_realtime add table public.telemetry_readings;
alter publication supabase_realtime add table public.fall_events;
