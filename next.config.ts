import type { NextConfig } from "next";

/**
 * Baseline security headers applied to every response. The app has no inline
 * scripts (Next.js inlines a tiny bootstrap that we allow via 'self' + the
 * standard 'unsafe-inline' for the runtime). Tweak if you add embeds or
 * third-party widgets.
 */
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js + React need inline + eval for hydration; analytics SDKs add a few hostnames.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.vercel-scripts.com https://va.vercel-scripts.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' https://*.githubusercontent.com",
      "font-src 'self' data:",
      // Supabase Realtime is wss; REST is https.
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.vercel-insights.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
