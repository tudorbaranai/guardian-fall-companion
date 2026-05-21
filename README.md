# The Guardian — Fall Detection Companion

A caregiver companion web app for a wearable fall-detection and vital-monitoring
device for elderly users. This is **Option 1 — "The Guardian"** from the design
brief: premium and confident, soft navy + cool grey-white + sage, layered cards
and a softly-glowing shield.

**Repository:** https://github.com/tudorbaranai/guardian-fall-companion (private)
**Built for:** HARD&SOFT Suceava 2026 hardware competition.

> **The brain is a microcontroller.** This repo is only the *screen and the
> caregiver-side actions*. Fall detection, heart-rate / SpO₂ / accelerometer
> reading, and state classification all run on the wearable's microcontroller.
> This app renders what the device reports and lets a caregiver respond.

## Stack

- **Next.js 16** (App Router, TypeScript)
- **Tailwind CSS v4** + **shadcn/ui** (Button, Card, Badge, Separator)
- **Atkinson Hyperlegible** font — designed for low-vision readers
- Hosting target: **Vercel**

## Screens

| Route       | Screen                                                       |
| ----------- | ------------------------------------------------------------ |
| `/`         | Caregiver Home / Dashboard — responsive (mobile + desktop)   |
| `/alert`    | Fall Alert — emergency takeover with 30-second cancel window |
| `/history`  | Fall history                                                 |
| `/settings` | Device, care circle and alert settings                       |

The Home route is a single responsive page: a one-column mobile layout with a
bottom tab bar below `lg`, and a two-column console with a sidebar at `lg`+.

## Data source — Supabase

The wearable's readings reach Supabase through an external ingestion path
(sensors → phone over Bluetooth → companion phone app → Supabase) that is
*not* part of this repo. This web app is read-only against the same tables:
it subscribes to `telemetry_readings` and `fall_events` via **Supabase
Realtime** and renders the dashboard live.

```
       (out of scope)                                this repo
sensor ──BLE──▶ phone app ──HTTPS──▶  Supabase  ──Realtime──▶  browser
```

- `src/lib/telemetry.ts` — the `Telemetry` row shape and `applyTelemetry()`
  which folds one row into the app's `DeviceSnapshot`.
- `src/lib/supabase.ts` — the Supabase client, the realtime subscriptions
  and the read helpers for telemetry + falls.
- `src/components/guardian/device-provider.tsx` — seeds on mount, subscribes
  to inserts, latches the fall alert, and shares the live snapshot.

The browser seeds from the latest row on mount, then keeps in sync via
Supabase Realtime — one WebSocket per tab, sub-100 ms latency, zero polling
when idle. A slow 30 s catch-up `SELECT` covers any WebSocket dropouts. The
Realtime migration (`20260521120000_realtime.sql`) must be applied before
first run; without it the subscription connects but never receives events.
Project settings are overridable via `NEXT_PUBLIC_SUPABASE_*` env vars —
see `.env.example`.

`DeviceSnapshot` in `src/lib/device.ts` remains the UI-facing contract.
`/api/device` is kept as a simple inspection / alternative-feed endpoint.

**Demo helper:** `POST /api/device` with `{"simulate":"fall"}` or
`{"simulate":"well"}` flips the device state so the Fall Alert flow can be
demoed without firmware.

## Run locally

```bash
npm install
npm run dev      # http://localhost:3000
```

```bash
npm run build && npm run start   # production build
```

## Deploy to Vercel

A standard Next.js app — Vercel needs no extra configuration.

1. Push this folder to a Git repository.
2. Import it at [vercel.com/new](https://vercel.com/new).
3. Deploy. (Or run `npx vercel` from this directory.)

## Project structure

```
src/
  app/
    page.tsx            Home dashboard (responsive)
    alert/page.tsx      Fall Alert screen
    history/page.tsx    Fall history
    settings/page.tsx   Settings
    api/device/route.ts Microcontroller integration endpoint
  components/guardian/  Guardian design system (shield, cards, nav, …)
  components/ui/        shadcn/ui primitives
  hooks/use-device.ts   Live device subscription
  lib/device.ts         DeviceSnapshot contract + helpers
```

## Accessibility

Built to the brief's requirements: body text ≥ 18px, CTA text ≥ 20px bold,
1.6× line height, 0.02em letter-spacing, left-aligned text, ≥ 56px touch
targets, and WCAG 2.1 AAA (7:1) contrast for body text. Every status uses
icon + colour + text label — never colour alone. Motion respects
`prefers-reduced-motion`.

## Status & next steps

**Done so far** — the four screens, the responsive dashboard, the Fall Alert
flow, and the `/api/device` integration seam. `npm run build` and `npm run lint`
both pass.

**Not done yet** — picked up here next time:

- **Connect the real microcontroller**: have the firmware `POST` readings to
  `/api/device`, and replace the in-memory store in
  `src/app/api/device/route.ts` with persistent storage.
- **Deploy to Vercel** (see above) — not deployed yet.
- `/history` and `/settings` use placeholder content; wire them to real data.
- `Maria` / `Sofia` / phone number / `+40` number are placeholders.
