import { NextResponse } from "next/server";
import type { CareContactRecord } from "@/lib/settings";

/**
 * Emergency notification endpoint.
 *
 *   POST /api/notify
 *   {
 *     "contacts":      CareContactRecord[],
 *     "personName":    "Maria",
 *     "detectedAt":    "2026-05-20T08:14:22.000Z",
 *     "emergencyLine": "112"
 *   }
 *
 * For every contact with a non-empty email, an email is sent through Resend
 * (https://resend.com) when `RESEND_API_KEY` is configured. Without a key
 * the route still returns success, logging the payload it *would* have sent
 * — the demo flow stays unbroken even with no email provider hooked up yet.
 *
 * Resend gives `onboarding@resend.dev` as a no-setup sender; override it
 * via `RESEND_FROM_EMAIL` once you have a verified domain.
 */

export const dynamic = "force-dynamic";

interface NotifyBody {
  contacts: CareContactRecord[];
  personName: string;
  detectedAt: string;
  emergencyLine: string;
}

interface ResendResponse {
  id?: string;
  message?: string;
}

async function sendOne(opts: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: opts.from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as ResendResponse;
  if (!res.ok) return { ok: false, error: body.message ?? `HTTP ${res.status}` };
  return { ok: true };
}

export async function POST(request: Request) {
  let body: NotifyBody;
  try {
    body = (await request.json()) as NotifyBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const recipients = (body.contacts ?? []).filter((c) => c.email?.includes("@"));
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? "Guardian <onboarding@resend.dev>";

  const subject = `Fall detected — ${body.personName} may need help`;
  const text =
    `A fall was detected on ${body.personName}'s wearable at ` +
    `${new Date(body.detectedAt).toLocaleString()}.\n\n` +
    `If no one dismisses the alert in time, emergency services ` +
    `(${body.emergencyLine}) will be called automatically.\n\n` +
    `— The Guardian`;

  // No key → no real email. Log + return success so the UI flow proceeds.
  if (!apiKey) {
    console.warn(
      "[notify] RESEND_API_KEY missing — would have emailed:",
      recipients.map((c) => c.email).join(", "),
    );
    return NextResponse.json({
      sent: 0,
      skipped: recipients.length,
      mode: "logged-only",
    });
  }

  const results = await Promise.all(
    recipients.map((c) =>
      sendOne({ apiKey, from, to: c.email, subject, text }).then((r) => ({
        email: c.email,
        ...r,
      })),
    ),
  );
  const sent = results.filter((r) => r.ok).length;
  const errors = results.filter((r) => !r.ok);
  if (errors.length > 0) {
    console.warn("[notify] some sends failed:", errors);
  }
  return NextResponse.json({
    sent,
    skipped: results.length - sent,
    mode: "resend",
    ...(errors.length > 0 && { errors }),
  });
}
