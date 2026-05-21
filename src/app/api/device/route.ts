import { NextResponse } from "next/server";
import {
  defaultSnapshot,
  fallSnapshot,
  type DeviceSnapshot,
} from "@/lib/device";

/**
 * Device endpoint — the integration seam with the wearable microcontroller.
 *
 *   GET  /api/device   → the caregiver app reads the latest snapshot
 *   POST /api/device   → the microcontroller pushes new sensor readings
 *
 * The store below is in-memory: fine for a demo / single-device build. For a
 * fleet of devices, swap `snapshot` for a database or the device's own
 * cloud endpoint — the `DeviceSnapshot` contract stays the same.
 */

export const dynamic = "force-dynamic";

let snapshot: DeviceSnapshot = defaultSnapshot();

export async function GET() {
  return NextResponse.json(snapshot);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const update = body as Partial<DeviceSnapshot> & { simulate?: "fall" | "well" };

  // Convenience hooks for demoing the alert flow without firmware.
  if (update.simulate === "fall") {
    snapshot = fallSnapshot();
    return NextResponse.json(snapshot);
  }
  if (update.simulate === "well") {
    snapshot = defaultSnapshot();
    return NextResponse.json(snapshot);
  }

  // A real device posts a partial reading; merge it into the current state.
  snapshot = { ...snapshot, ...update, lastCheckedAt: new Date().toISOString() };
  return NextResponse.json(snapshot);
}
