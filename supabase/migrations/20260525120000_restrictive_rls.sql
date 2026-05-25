-- Guardian — tighten RLS on telemetry / fall events.
--
-- Background: the original policies were `with check (true)` for the anon
-- role, which combined with a public publishable key means anyone on the
-- internet could insert / update arbitrary rows (fake falls → email spam,
-- telemetry flood → DoS).
--
-- This migration scopes anon writes to a single known `device_id` so a
-- leaked publishable key can only write into the row-space already owned
-- by the team's wearable. Reads stay open — the dashboard is meant to be
-- viewable without auth.
--
-- For a production fleet, replace `'device01'` with a per-device check
-- (e.g. JWT claim) and switch the ingestion process to a service-role key.

-- ── telemetry_readings ─────────────────────────────────────────────────────
drop policy if exists "telemetry_readings insert" on public.telemetry_readings;
create policy "telemetry_readings insert" on public.telemetry_readings
  for insert to anon, authenticated
  with check (device_id = 'device01');

-- ── fall_events ────────────────────────────────────────────────────────────
drop policy if exists "fall_events insert" on public.fall_events;
create policy "fall_events insert" on public.fall_events
  for insert to anon, authenticated
  with check (device_id = 'device01');

drop policy if exists "fall_events update" on public.fall_events;
create policy "fall_events update" on public.fall_events
  for update to anon, authenticated
  using (device_id = 'device01')
  with check (device_id = 'device01');
