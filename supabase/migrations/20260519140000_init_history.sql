-- Guardian — telemetry history + fall events.
--
-- Apply this either with the Supabase CLI (`supabase db push`) or by pasting
-- it into the Supabase dashboard → SQL Editor → Run.
--
-- The wearable writes here with the project's *publishable* key, which acts
-- as the `anon` role — so the RLS policies below grant anon insert/select/
-- update. The browser only reads from these tables (via Realtime).

-- ── Telemetry readings ─────────────────────────────────────────────────────
-- One sample (~every 5–10 s) from the wearable, used both as the live feed
-- (via Supabase Realtime) and as the history view.
create table if not exists public.telemetry_readings (
  id          bigint generated always as identity primary key,
  device_id   text        not null default 'device01',
  recorded_at timestamptz not null default now(),
  hr          real,
  spo2        real,
  temp        real,
  stress      real,
  batt_pct    real,
  batt_v      real,
  ax          real,
  ay          real,
  az          real,
  gx          real,
  gy          real,
  gz          real
);

create index if not exists telemetry_readings_device_time_idx
  on public.telemetry_readings (device_id, recorded_at desc);

alter table public.telemetry_readings enable row level security;

drop policy if exists "telemetry_readings insert" on public.telemetry_readings;
create policy "telemetry_readings insert" on public.telemetry_readings
  for insert to anon, authenticated with check (true);

drop policy if exists "telemetry_readings select" on public.telemetry_readings;
create policy "telemetry_readings select" on public.telemetry_readings
  for select to anon, authenticated using (true);

-- ── Fall events ────────────────────────────────────────────────────────────
-- One row per detected fall; `resolved_at` / `false_alarm` are filled in when
-- the caregiver dismisses the alert.
create table if not exists public.fall_events (
  id          bigint generated always as identity primary key,
  device_id   text        not null default 'device01',
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  false_alarm boolean     not null default false
);

create index if not exists fall_events_device_time_idx
  on public.fall_events (device_id, detected_at desc);

alter table public.fall_events enable row level security;

drop policy if exists "fall_events insert" on public.fall_events;
create policy "fall_events insert" on public.fall_events
  for insert to anon, authenticated with check (true);

drop policy if exists "fall_events select" on public.fall_events;
create policy "fall_events select" on public.fall_events
  for select to anon, authenticated using (true);

drop policy if exists "fall_events update" on public.fall_events;
create policy "fall_events update" on public.fall_events
  for update to anon, authenticated using (true) with check (true);
