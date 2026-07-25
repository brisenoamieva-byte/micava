export type SignupNotifyPayload = {
  email: string;
  displayName?: string | null;
  provider?: string;
  userId?: string;
};

/** Best-effort in-memory dedupe (per isolate). */
const recent = new Map<string, number>();
const DEDUPE_MS = 60 * 60 * 1000;

function alreadyNotified(email: string): boolean {
  const key = email.trim().toLowerCase();
  const now = Date.now();
  const prev = recent.get(key);
  if (prev && now - prev < DEDUPE_MS) return true;
  recent.set(key, now);
  // prune
  if (recent.size > 500) {
    for (const [k, t] of recent) {
      if (now - t > DEDUPE_MS) recent.delete(k);
    }
  }
  return false;
}

function formatMessage(p: SignupNotifyPayload): string {
  const name = p.displayName?.trim() || "Sin nombre";
  const provider = p.provider?.trim() || "email";
  return [
    "Nueva cuenta en Cavatale",
    `Nombre: ${name}`,
    `Email: ${p.email}`,
    `Vía: ${provider}`,
    p.userId ? `Id: ${p.userId}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

async function sendDiscordOrSlack(
  webhookUrl: string,
  text: string
): Promise<void> {
  const isSlack = /hooks\.slack\.com/i.test(webhookUrl);
  const body = isSlack
    ? { text }
    : {
        // Discord (and many generic webhooks)
        content: text,
      };
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function sendResendEmail(text: string, subject: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const to = process.env.FOUNDER_NOTIFY_EMAIL?.trim();
  if (!apiKey || !to) return;

  const from =
    process.env.RESEND_FROM_EMAIL?.trim() || "Cavatale <onboarding@resend.dev>";

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
    }),
  });
}

/**
 * Notify the founder that someone created an account.
 * Configure SIGNUP_WEBHOOK_URL (Discord/Slack) and/or RESEND_API_KEY + FOUNDER_NOTIFY_EMAIL.
 */
export async function notifyNewSignup(
  payload: SignupNotifyPayload
): Promise<{ sent: boolean; reason?: string }> {
  const email = payload.email?.trim();
  if (!email) return { sent: false, reason: "missing email" };

  if (alreadyNotified(email)) {
    return { sent: false, reason: "deduped" };
  }

  const webhook = process.env.SIGNUP_WEBHOOK_URL?.trim();
  const canEmail = Boolean(
    process.env.RESEND_API_KEY?.trim() &&
      process.env.FOUNDER_NOTIFY_EMAIL?.trim()
  );

  if (!webhook && !canEmail) {
    console.warn(
      "[notify-signup] No SIGNUP_WEBHOOK_URL or RESEND_API_KEY+FOUNDER_NOTIFY_EMAIL configured."
    );
    return { sent: false, reason: "not configured" };
  }

  const text = formatMessage({ ...payload, email });
  const jobs: Promise<unknown>[] = [];

  if (webhook) {
    jobs.push(sendDiscordOrSlack(webhook, text));
  }
  if (canEmail) {
    jobs.push(
      sendResendEmail(text, `Nueva cuenta Cavatale · ${email}`)
    );
  }

  const results = await Promise.allSettled(jobs);
  const ok = results.some((r) => r.status === "fulfilled");
  return ok ? { sent: true } : { sent: false, reason: "all channels failed" };
}

export function isRecentlyCreatedUser(createdAt: string | undefined): boolean {
  if (!createdAt) return false;
  const t = new Date(createdAt).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < 15 * 60 * 1000;
}
