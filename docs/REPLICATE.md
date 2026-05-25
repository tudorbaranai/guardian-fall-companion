# How to rebuild this project from scratch

A future builder reading this should be able to recreate the complete winning
entry — hardware, firmware, AI models, Supabase schema, and the caregiver
web app — end to end. Where decisions were context-dependent (jury feedback,
specific Edge Impulse tunings) the rationale is preserved so they can be
revisited.

The system has four layers that can be built in this order:

1. **Hardware** — assemble the wearable
2. **AI** — collect a dataset and train two Edge Impulse impulses
3. **Firmware** — flash the ESP32 with the integrated firmware
4. **Web app** — provision Supabase and run the caregiver dashboard

Skip step 2 if you reuse the impulses already exported into
[`firmware/src/merged/`](../firmware/src/merged/).

---

## 1. Hardware

Follow [`HARDWARE.md`](HARDWARE.md) for the full BOM and the ESP32 pin map.
Notes for a clean re-build:

- Match the **strap position** the original training data was captured on
  (upper arm / bicep, OLED facing outward). The activity classifier baked
  the mounting geometry into the model — moving it to the wrist or chest
  will degrade accuracy.
- Confirm the IMU's full-scale range is set to **±16 g / ±1000 °/s** before
  collecting any training data. The trigger gate's thresholds (2.2 g
  freefall-exit, 3.5 g stumble) assume that range.
- The MAX32664 bio-hub needs both **RESET** (GPIO 16) and **MFIO** (GPIO 17)
  in addition to I²C. Without those two pins the bio-hub won't enumerate.
- Use a Li-ion charger with **protection** (TP4056 + DW01 is fine). The
  firmware reads the divided VBAT on GPIO 35; calibrate the divider ratio
  in `voltageToPercent()` if you don't use 1:1 100 kΩ resistors.

## 2. AI — train the two Edge Impulse impulses

Two impulses are needed; both were trained jointly by Tudor Baranai and Robu
Gabriel in [Edge Impulse Studio](https://edgeimpulse.com/).
The exported C++ libraries live in `firmware/src/merged/`. If you want to
retrain (e.g., for a different mounting position or for a new wearer
population), the recipe used at the competition was:

### Data collection — on the actual hardware

Stream live 7-channel windows into Edge Impulse Studio via the **serial
data forwarder**, sampling at **100 Hz on the production wearable**. The
seven channels are:

```
ax | ay | az | gx | gy | gz | |a|
```

The `|a|` channel (acceleration magnitude) is precomputed so the model
doesn't have to learn it from scratch.

### Model A — activity classifier (4-class)

Capture several minutes per class on the upper arm:

| Class         | Coverage                                                   |
| ------------- | ---------------------------------------------------------- |
| `stationary`  | Standing, sitting still                                    |
| `walking`     | Indoor + outdoor pace, both speeds                         |
| `running`     | Steady-state jogging                                       |
| `hand_motion` | Gesturing, reaching, fidgeting — hardest negative class    |

Impulse design: spectral-analysis DSP block (FFT magnitudes + RMS) →
fully-connected NN → 4 alphabetical classes. Labels are remapped to the
firmware's internal order via `EI_TO_INTERNAL[]` in `firmware/src/main.cpp`.

### Model B — fall classifier (binary)

The critical work. Capture pairs of:

| Positives                       | Negatives (false-positive bait)               |
| ------------------------------- | --------------------------------------------- |
| Forward falls                   | Sitting down hard                             |
| Backward falls                  | Dropping into a chair                         |
| Left-side falls                 | Slamming a door                               |
| Right-side falls                | Putting the arm down forcefully               |
| Natural body-collapse sims      | Jumping; footstrikes during walk/run          |

Each window must be **labelled with the activity tag** that Model A would
have been emitting at that moment. This is the trick that lets a single
fall model behave correctly across different motion contexts — a 3 g spike
during `running` is a footstrike; the same spike during `stationary` is a
real event.

Impulse design: 11-channel input (7-ch IMU + 4-ch one-hot activity tag) →
DSP feature block → 1-D ConvNet → `{ fall | not_fall }`.

### Training settings used at the competition

- **Split:** standard Edge Impulse 80 / 20 train-validation + held-out test
- **Augmentation:** Studio defaults — generalisation came from diverse
  negative examples, not from augmentation tricks
- **Operating point:** chosen from the precision-recall curve to **favour
  recall** — the firmware's stillness + orientation gates filter false
  positives downstream, so the ML stage can stay loose
- **Validated results** (fall classifier): **94.2 % accuracy**, 0.94
  weighted F1, AUC 0.93; **2 ms inference**, 3.2 KB RAM, 50.7 KB flash on
  the 80 MHz ESP32 — see [`docs/screenshots/ai-training.jpeg`](screenshots/ai-training.jpeg)
  and [`docs/media/ai-training.mp4`](media/ai-training.mp4)

### Deployment

Export the impulses as a **C++ library** (Studio → Deployment →
"C++ library"), unzip into `firmware/src/merged/` and the multi-impulse
build will pick both up. The firmware references them by handle:

| Handle                       | Role             | Input                                |
| ---------------------------- | ---------------- | ------------------------------------ |
| `impulse_handle_1003832_1`   | Activity         | 7-ch IMU window                      |
| `impulse_handle_1004073_1`   | Fall             | 11-ch window (IMU + activity tag)    |

## 3. Firmware

The full firmware is in [`firmware/`](../firmware/). It is a PlatformIO
project. The `huge_app.csv` partition (3 MB app) is **required** — the Edge
Impulse SDK + Bluedroid BLE stack exceed the default 1.3 MB layout.

```bash
cd firmware
pio run                  # build
pio run -t upload        # flash
pio device monitor       # serial @ 115200
```

All library dependencies are pinned in [`firmware/platformio.ini`](../firmware/platformio.ini).
Before deploying anything beyond the demo, replace the BLE service UUID at
the top of `firmware/src/main.cpp` so a stranger's phone doesn't latch onto
the device.

See [`firmware/README.md`](../firmware/README.md) for the full firmware
documentation — three-gate detection pipeline, FreeRTOS task model, BLE
protocol, and OLED UI.

## 4. Web app — Supabase + Next.js

The caregiver dashboard reads two tables (`telemetry_readings` and
`fall_events`) from Supabase via Supabase Realtime. To stand up a fresh
project:

```bash
# 1. Provision a Supabase project (https://supabase.com → New project)
#    Copy the project URL and the publishable (anon) key.

# 2. Apply the schema. Either:
#      supabase db push   (Supabase CLI)
#    or paste each file in supabase/migrations/ into the SQL Editor and run.
#    The realtime migration (20260521120000_realtime.sql) is essential — without
#    it the websocket subscribes but no events arrive.

# 3. Configure the web app
cp .env.example .env.local
# edit .env.local with your Supabase URL + publishable key

# 4. Run
npm install
npm run dev    # http://localhost:3000
```

For deployment to Vercel:

1. Push the repo to GitHub.
2. Import on [vercel.com/new](https://vercel.com/new).
3. Set the same env vars (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) in the Vercel project settings.
4. Deploy. Optionally point a domain at it — the original lives at
   <https://guardian-companion.tech>.

## 5. The phone bridge (out of scope, but you need one)

Both this repo and the firmware repo intentionally stop at the BLE / Supabase
boundary. To complete the demo system you need a process that:

1. Pairs with the BLE `FallGuard` service (UUID `f00dbabe-…`)
2. Subscribes to the 19-byte telemetry packet (notify, 2 Hz)
3. Subscribes to the `FALL` event notification
4. Writes each telemetry packet as a row into `telemetry_readings`
5. Writes each `FALL` notification as a row into `fall_events`

For the competition demo this was a small Android app that mapped the
packet layout directly to column names. Any equivalent — a Bluetooth-enabled
edge gateway, a Raspberry Pi running a Python bridge with `bleak` + the
Supabase JS client, etc. — will work the same way. The telemetry packet
layout is documented in [`firmware/README.md`](../firmware/README.md#-ble-protocol).
