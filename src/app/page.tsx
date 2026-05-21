"use client";

import { useState } from "react";
import { useDevice } from "@/components/guardian/device-provider";
import { BottomNav, Sidebar } from "@/components/guardian/nav";
import { HomeMobile } from "@/components/guardian/home-mobile";
import { HomeDesktop } from "@/components/guardian/home-desktop";
import { SosButton } from "@/components/guardian/sos-button";
import { VitalDetailModal } from "@/components/guardian/vital-detail-modal";
import type { VitalKey } from "@/lib/vitals";

/**
 * Caregiver Home / Dashboard.
 *
 * One responsive route: the mobile single-column layout below `lg`, the
 * two-column desktop console with sidebar at `lg` and up. Both render the
 * same live snapshot streamed from the wearable device. Tapping a vital card
 * opens its detailed-trend modal.
 */
export default function HomePage() {
  const { snapshot, now } = useDevice();
  const [vital, setVital] = useState<VitalKey | null>(null);

  return (
    <div className="flex min-h-dvh bg-canvas">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="lg:hidden">
          <HomeMobile snapshot={snapshot} now={now} onSelectVital={setVital} />
        </div>
        <div className="hidden min-w-0 flex-1 lg:flex">
          <HomeDesktop snapshot={snapshot} now={now} onSelectVital={setVital} />
        </div>
      </main>
      <BottomNav />
      <SosButton />
      <VitalDetailModal vital={vital} onClose={() => setVital(null)} />
    </div>
  );
}
