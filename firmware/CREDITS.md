# Firmware credits

The C/C++ firmware in this folder — sensor drivers, BLE stack, FreeRTOS task
model, the three-gate fall-detection pipeline, the 9-page OLED UI, and the
on-device Edge Impulse inference loop — was written by **Robu Gabriel** as
part of team **Sudo**'s entry to HARD & SOFT Suceava 2026.

It is included here as a snapshot of the project's firmware deliverable so
this repository contains the complete winning entry and can be replicated by
a future builder. The canonical upstream is:

> 🔗 **[github.com/RobuGabrie/esp32-fall-detection](https://github.com/RobuGabrie/esp32-fall-detection)**

For any new feature work or bug fix on the firmware itself, prefer opening a
PR against the upstream repo so Gabriel remains the single source of truth.

## Edge Impulse models

The two Edge Impulse impulses in [`src/merged/`](src/merged/) — the 4-class
activity classifier and the binary fall detector — were trained jointly by
**Tudor Baranai** and **Robu Gabriel** in Edge Impulse Studio. Training
included on-device data capture via the Edge Impulse data forwarder
(sampled at 100 Hz on the production wearable, same strap and ±16 g range
used at runtime), labelling of positive and negative classes, model
selection, and the multi-impulse C++ export that links into the firmware.

The screenshot at [`docs/screenshots/ai-training.jpeg`](../docs/screenshots/ai-training.jpeg)
shows the fall classifier's validation metrics (94.2 % accuracy, 0.94
weighted F1, 2 ms inference on ESP32). A short demo video of the training
session is at [`docs/media/ai-training.mp4`](../docs/media/ai-training.mp4).

## License

The upstream firmware repo carries no explicit licence and is treated as
**all-rights-reserved by Robu Gabriel**. This snapshot is included with
Gabriel's agreement as a teammate on the project. If you want to reuse the
firmware code outside the context of this repository, contact Gabriel
directly.

The Edge Impulse SDK vendored under `src/merged/edge-impulse-sdk/` carries
its own Apache 2.0 licence (see headers inside that folder).
