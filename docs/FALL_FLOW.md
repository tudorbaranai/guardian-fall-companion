# Fall-to-reaction flow

Everything that happens between a fall reaching Supabase and the caregiver
clearing the alert. Cross-references are `file:line` so the diagram and the
code stay honest with each other.

Things to keep in mind:

- **Supabase is the live link now.** The browser no longer connects to MQTT.
  The wearable/phone ingestion path writes `telemetry_readings` and
  `fall_events` rows; the app reads them through Supabase Realtime plus a
  30-second catch-up poll.
- **The countdown is informational, not an auto-dialer.** When it reaches zero
  the modal copy changes and the ring empties. The caregiver still has to tap
  a `tel:` link to call the wearer or emergency services.
- **Dismissal records `false_alarm = true`.** There is no separate "confirmed
  fall handled" resolution path yet.
- **`quietHours` is currently a no-op.** The setting exists, but no runtime
  audio/vibration behavior consults it.

---

## Diagram

```mermaid
flowchart TD
    %% Triggers
    Sensor["Wearable + phone ingestion<br/>INSERT telemetry_readings<br/>INSERT fall_events when fall detected"]:::trigger
    SOS["Caregiver SOS button<br/>simulate('fall')"]:::trigger

    %% Supabase realtime path
    Sensor --> Telemetry[("Supabase<br/>telemetry_readings")]:::side
    Sensor --> FallRows[("Supabase<br/>fall_events")]:::side
    SOS --> StartFall["recordFallStart()<br/>INSERT fall_events"]:::core
    StartFall --> FallRows

    Telemetry --> SeedTelemetry["fetchLatestTelemetry()<br/>seed dashboard on mount"]:::side
    Telemetry --> LiveTelemetry["subscribeTelemetry()<br/>Realtime INSERTs<br/>+ 30 s catch-up SELECT"]:::side
    SeedTelemetry --> Snapshot["applyTelemetry()<br/>update vitals, battery,<br/>motion sparklines"]:::core
    LiveTelemetry --> Snapshot

    FallRows --> OpenFall["fetchOpenFallEvent()<br/>re-latch unresolved fall<br/>after page refresh"]:::side
    FallRows --> LiveFall["subscribeFallEvents()<br/>Realtime INSERTs<br/>+ 30 s catch-up SELECT"]:::side
    OpenFall --> Latch
    LiveFall --> Latch
    StartFall --> LocalLatch["local fallActive = true<br/>while insert id resolves"]:::core
    LocalLatch --> Latch

    %% Latch + side effects
    Latch{{"engageFall / withFall<br/>fallActive = true<br/>fallStartedAt = detected_at<br/>snapshot.status = 'fall'"}}:::core
    Latch --> Notify["notifyContacts()<br/>POST /api/notify<br/>contacts + person + emergencyLine"]:::side
    Latch --> Modal[/"AlertModal renders<br/>global modal over current page"/]:::ui

    %% Notify branching
    Notify --> HasContacts{"contacts with<br/>email?"}:::decision
    HasContacts -->|no| NoNotify["No outbound request"]:::side
    HasContacts -->|yes| HasKey{"RESEND_API_KEY<br/>set?"}:::decision
    HasKey -->|yes| Resend["Resend email per contact"]:::side
    HasKey -->|no| Logged["Logged-only mode<br/>returns success"]:::side

    %% Modal countdown
    Modal --> Countdown["remaining = falseAlarmSeconds<br/>- elapsed since detectedAt"]:::ui
    Countdown --> CountZero{"remaining <= 0?"}:::decision
    CountZero -->|no| WaitCopy["UI copy:<br/>'has not responded'<br/>'Alert sent X seconds ago'"]:::ui
    CountZero -->|yes| ExpiredCopy["UI copy:<br/>'Calling emergency services now'<br/>'Stay on the line'<br/><b>no automatic call</b>"]:::warn

    %% Caregiver actions
    WaitCopy --> Actions
    ExpiredCopy --> Actions
    Actions{"Caregiver action"}:::decision
    Actions -->|"Call wearer"| CallWearer["tel:{person.phone}<br/>native dialer"]:::action
    Actions -->|"Call Emergency Services"| CallEmergency["tel:{emergencyFor(country).number}<br/>native dialer"]:::action
    Actions -->|"Close X"| Clear
    Actions -->|"Mark false alarm<br/>then confirm safe"| Clear

    %% Resolution
    Clear["simulate('well')<br/>clear local fall latch"]:::core
    Clear --> ResolveDb[("recordFallResolve(id, true)<br/>resolved_at = now<br/>false_alarm = true")]:::side
    Clear --> CloseModal["snapshot.status = 'well'<br/>modal unmounts"]:::ui

    %% Settings
    subgraph Settings ["Settings that affect the flow"]
        direction LR
        S1["falseAlarmSeconds<br/>countdown duration"]:::cfg
        S2["emergencyCountry<br/>emergency dial number"]:::cfg
        S3["contacts[]<br/>email recipients"]:::cfg
        S4["quietHours<br/>currently no-op"]:::cfgWarn
    end

    S1 -.-> Countdown
    S2 -.-> CallEmergency
    S2 -.-> Notify
    S3 -.-> Notify

    classDef trigger fill:#fde9c4,stroke:#c2851b,stroke-width:1.5px,color:#3a2a06
    classDef core fill:#dfeaf6,stroke:#3a6a9c,stroke-width:1.5px,color:#0d2238
    classDef side fill:#e8f1e4,stroke:#5b8a3f,stroke-width:1px,color:#1f3814
    classDef ui fill:#f3eef8,stroke:#7c5fa7,stroke-width:1px,color:#231541
    classDef warn fill:#fbe4e4,stroke:#bb2a33,stroke-width:1.5px,color:#3c0a0d
    classDef action fill:#fff,stroke:#384258,stroke-width:1.5px,color:#131826
    classDef decision fill:#fff5d6,stroke:#a07b1f,stroke-width:1px,color:#3a2a06
    classDef cfg fill:#eef2f7,stroke:#5a6378,stroke-width:1px,color:#131826
    classDef cfgWarn fill:#fbe4e4,stroke:#bb2a33,stroke-width:1px,color:#3c0a0d
```

---

## Reference table

| Step | Code | Notes |
|---|---|---|
| Supabase is the app transport/history store | [supabase.ts](../src/lib/supabase.ts) | browser reads telemetry/falls; telemetry itself is written outside the app |
| Latest telemetry seeds the dashboard | [device-provider.tsx:166](../src/components/guardian/device-provider.tsx) | avoids an empty dashboard after refresh if a row already exists |
| Telemetry Realtime subscription | [supabase.ts:118](../src/lib/supabase.ts) | listens to `telemetry_readings` INSERTs and runs a 30 s catch-up SELECT |
| Open fall re-latches after refresh | [supabase.ts:182](../src/lib/supabase.ts) | reads unresolved `fall_events` rows |
| Fall Realtime subscription | [supabase.ts:208](../src/lib/supabase.ts) | listens to new `fall_events` rows |
| Fall latch | [device-provider.tsx:146](../src/components/guardian/device-provider.tsx) | sets `fallActive`, stores the row id, and notifies contacts |
| Snapshot fall overlay | [device-provider.tsx:122](../src/components/guardian/device-provider.tsx) | turns the shared snapshot into `status: "fall"` |
| SOS creates a fall row | [device-provider.tsx:310](../src/components/guardian/device-provider.tsx) | calls `recordFallStart()` and immediately latches locally |
| Fall row insert | [supabase.ts:263](../src/lib/supabase.ts) | inserts into `fall_events` for `device01` |
| Notification request | [device-provider.tsx:98](../src/components/guardian/device-provider.tsx) | best-effort `POST /api/notify` if contacts exist |
| Notification endpoint | [api/notify/route.ts:63](../src/app/api/notify/route.ts) | sends Resend email when configured; otherwise logs and returns success |
| Countdown source | [alert-modal.tsx:42](../src/components/guardian/alert-modal.tsx) | reads `settings.falseAlarmSeconds` |
| Countdown calculation | [alert-modal.tsx:67](../src/components/guardian/alert-modal.tsx) | clamps elapsed time to `0..falseAlarmSeconds` |
| Manual wearer call | [alert-modal.tsx:170](../src/components/guardian/alert-modal.tsx) | `tel:{person.phone}` |
| Manual emergency call | [alert-modal.tsx:180](../src/components/guardian/alert-modal.tsx) | `tel:{emergencyFor(country).number}` |
| Dismissal action | [alert-modal.tsx:78](../src/components/guardian/alert-modal.tsx) | calls `simulate("well")`; close X does the same directly |
| Fall row resolution | [supabase.ts:277](../src/lib/supabase.ts) | writes `resolved_at` and `false_alarm` |

---

## Gaps worth flagging

- **No automatic emergency call.** The alert copy and notification email still
  imply auto-calling, but the implemented behavior is manual `tel:` links.
  Real auto-call would require a server-side voice provider such as Twilio or
  Vonage.
- **No confirmed-fall resolution state.** The only implemented close path calls
  `recordFallResolve(id, true)`, so every resolved row becomes a false alarm.
- **`quietHours` is not wired.** The setting is persisted, but there are no
  audible or vibration cues for it to suppress.
- **Email only.** `/api/notify` sends Resend email or logs in demo mode. SMS,
  push notifications, and phone calls are not implemented.
- **Sensor ingestion is outside this repo.** The browser assumes some upstream
  wearable/phone process inserts Supabase rows. This repo documents and reads
  that contract, but it does not own the ingestion service.
