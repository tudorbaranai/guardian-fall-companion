import type { Metadata } from "next";
import { BottomNav, Sidebar } from "@/components/guardian/nav";
import { MotionDashboard } from "@/components/guardian/motion-dashboard";

export const metadata: Metadata = {
  title: "Motion — The Guardian",
};

/**
 * Motion route — the MPU-6050 accelerometer / gyroscope console with the live
 * 3D posture mannequin. Rendered inside the Guardian app shell.
 */
export default function MotionPage() {
  return (
    <div className="flex min-h-dvh bg-canvas">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <MotionDashboard />
      </main>
      <BottomNav />
    </div>
  );
}
