# Security model

This project was built to win a hardware competition and to be a public
portfolio piece. It is **not** a production medical device. These trade-offs
are intentional, and each one says what a production build would change.

## Supabase key in the browser

The Supabase publishable (anon) key is shipped to the browser. Row-Level
Security restricts writes to a single known `device_id`, but anyone who reads
the repo can spoof telemetry or fall events for that device. That is
acceptable for a single-device demo; a production fleet would move ingestion
behind a service-role key on a server route, or scope RLS by a per-device JWT
claim.

## Email endpoint

`/api/notify` only accepts requests with a same-origin `Origin` header and
caps recipients per call. That blocks casual scripted abuse, but `Origin` is
spoofable from `curl`. The endpoint is safe today because no `RESEND_API_KEY`
is set in production, so it only logs. Don't set the Resend key without first
adding real auth (CSRF token, server-issued nonce, or a dedicated phone-bridge
service role).

## BLE on the wearable

The firmware's BLE service is unpaired and unauthenticated. Any device within
about 10 m can connect, read vitals, and write the `alert_off` command to
silence a real alarm. A production build must add `BLESecurity` bonding.

The BLE service UUID in `firmware/src/main.cpp` (`f00dbabe-…`) is a demo
identifier. Any device rebuilt from this snapshot must change it before a real
deployment so a stranger's app can't latch on.

## HTTP headers

Security headers (CSP, X-Frame-Options and others) are configured in
[`next.config.ts`](../next.config.ts). They are reasonable defaults; tighten
the CSP further if you add third-party embeds.
