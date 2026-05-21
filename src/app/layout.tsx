import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Geist_Mono } from "next/font/google";
import "./globals.css";
import { DeviceProvider } from "@/components/guardian/device-provider";
import { SettingsProvider } from "@/components/guardian/settings-provider";
import { AlertModal } from "@/components/guardian/alert-modal";

/**
 * Atkinson Hyperlegible is mandated by the brief — it is specifically designed
 * for low-vision readers. It is the app's primary typeface.
 */
const atkinson = Atkinson_Hyperlegible({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

/** Geist Mono — used only for the technical numeric readouts on the
 *  Motion (MPU-6050) console, where tabular figures must not jitter. */
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "The Guardian — Fall Detection Companion",
  description:
    "Calm, trustworthy fall detection and vital monitoring for the people you care for.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#eef1f5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${atkinson.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full">
        <SettingsProvider>
          <DeviceProvider>
            {children}
            {/* Fall-alert modal — appears over any page when a fall is detected */}
            <AlertModal />
          </DeviceProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
