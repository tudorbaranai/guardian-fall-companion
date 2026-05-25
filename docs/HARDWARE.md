# Hardware — Bill of Materials & Wiring

The wearable that powers the Guardian dashboard. Built around the kit supplied
by HARD & SOFT Suceava 2026: ESP32 + IMU + bio-hub + body-temperature sensor
+ OLED + LEDs + buzzer + Li-ion cell. All sensors talk over a single I²C bus,
inputs/outputs are on the ESP32's general-purpose GPIOs, and battery voltage
is read through a 2× resistor divider on an ADC pin.

## Bill of materials

| Qty | Part                | Role                       | Bus / interface           | Notes                              |
| --- | ------------------- | -------------------------- | ------------------------- | ---------------------------------- |
| 1   | ESP32-DevKitC       | Compute + BLE              | —                         | 80 MHz dual-core, BLE 4.2          |
| 1   | MPU6050             | Accelerometer + gyroscope  | I²C @ 400 kHz             | ±16 g, ±1000 °/s                   |
| 1   | SSD1306 128 × 64    | OLED display               | I²C, addr `0x3D`          | 9-page caregiver UI                |
| 1   | MAX30205            | Body temperature           | I²C                       | ±0.1 °C clinical-grade             |
| 1   | MAX32664            | HR / SpO₂ bio-hub          | I²C, dedicated reset+MFIO | Bio-hub manages PPG sensor stack   |
| 1   | LED (green)         | Status — "active"          | GPIO 32 (PWM)             |                                    |
| 1   | LED (yellow)        | Status — "warning"         | GPIO 33                   |                                    |
| 1   | LED (red)           | Status — "fall confirmed"  | GPIO 4                    | Driven during alarm                |
| 1   | Piezo buzzer        | Audible alarm              | GPIO 23 (LEDC @ 1.7 kHz)  | 3-second alert on confirmed fall   |
| 1   | Push button         | UI navigation              | GPIO 27 (INPUT_PULLUP)    | FALLING-edge interrupt             |
| 1   | Li-ion / LiPo cell  | Power                      | VBAT → divider            | 3.3 – 4.2 V, ≥ 500 mAh recommended |
| 2   | Resistor (≈ 100 kΩ) | 2× voltage divider for ADC | VBAT → GPIO 35            | Keeps ADC within 0–3.3 V           |
| 1   | TP4056 or equiv.    | Charger / protection       | USB-C in                  | Single-cell Li-ion charger         |
| —   | Breadboard + wiring | Prototype substrate        | —                         | 3D-printed enclosure for the demo  |

> 3D-printing facilities were provided on site by the organisers and used for
> the wearable's strap-mounted enclosure.

## ESP32 pin map

```
                  ┌──────────────────┐
   I²C   SDA ── 21│                  │ 35 ── VBAT / 2  (ADC)
         SCL ── 22│      ESP32       │
                  │     DevKitC      │ 32 ── LED green  (PWM)
   MAX32664 RST── 16│                  │ 33 ── LED yellow
              MFIO── 17│                  │  4 ── LED red
                  │                  │ 23 ── buzzer    (LEDC 1.7 kHz)
   button     ── 27│                  │
                  │                  │
                  └──────────────────┘
```

All four I²C peripherals (MPU6050, SSD1306, MAX30205, MAX32664) share `SDA=21`
and `SCL=22`. The bus runs at 400 kHz with a FreeRTOS mutex protecting access
between the 100 Hz sampling task (Core 1) and the slower telemetry / UI task
(Core 0).

Reference pinout, threshold constants, and timing values live at the top of
[`firmware/src/main.cpp`](../firmware/src/main.cpp).

## Power budget

- 80 MHz CPU clock (vs the default 240 MHz) drops current draw by ~3× with
  no impact on the 100 Hz IMU sampling or the 1 Hz / on-trigger ML
  inference budget.
- BLE advertising + telemetry @ 2 Hz dominates radio power.
- The firmware computes its own time-remaining estimate from a 21-point
  voltage look-up table plus a live mV reading; the web dashboard also
  computes a local estimate from a 3-hour voltage-sample window
  (see `src/lib/device.ts → estimateRuntime`) so the caregiver sees a
  cross-checked number.

## Enclosure & strap

- 3D-printed upper-arm enclosure, OLED window cut on the dorsal face.
- Velcro strap holds the device against the bicep so the IMU axis
  conventions (Z = away from skin, X = elbow-to-shoulder) stay consistent
  with the training data — this matters: the activity classifier was
  trained on the production hardware in this exact mounting, and changing
  the mounting changes the model's accuracy.

## What the data path looks like

```
ESP32 wearable                                            Caregiver web app
─ on-device fall detection                                ─ live dashboard
─ HR / SpO₂ / temp / IMU      BLE 2 Hz       Realtime     ─ 3D mannequin
─ OLED + buzzer + LEDs       ──────▶  Phone bridge  ────▶ Supabase  ─────▶
                                       (out of scope)    (telemetry_readings,
                                                          fall_events)
```

The phone bridge is intentionally out of scope for both this repo and
Gabriel's firmware repo: the device-side and caregiver-side were the two
judged deliverables. Any process that subscribes to the BLE `FallGuard`
service and forwards rows into Supabase will work; for the demo we used a
companion Android app that maps the 19-byte telemetry packet directly into
columns on `telemetry_readings`.
