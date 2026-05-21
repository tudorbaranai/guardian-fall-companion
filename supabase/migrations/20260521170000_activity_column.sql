-- Guardian — add `activity` to telemetry rows.
--
-- The phone-side classifier writes a coarse-grained activity label
-- ("Walking", "Running", "Stationary", "Falling") on each telemetry insert.
-- The dashboard reads this column to drive the 3D mannequin animation on
-- `/motion`. The fall-alert latch remains driven by `fall_events` — this
-- column is purely a posture / motion hint.
--
-- Apply via the Supabase CLI (`supabase db push`) or paste into the SQL
-- Editor → Run.

alter table public.telemetry_readings
  add column if not exists activity text;
