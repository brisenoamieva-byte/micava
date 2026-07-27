import * as Sentry from "@sentry/nextjs";
import { isSentryEnabled } from "@/lib/sentry-dsn";

type ApiRoute = "research-wine" | "scan-label";

/**
 * Light server-side capture for known API failures.
 * Never attach wine text, image payloads, model content, or API keys.
 */
export function captureApiFailure(
  route: ApiRoute,
  kind: string,
  error?: unknown,
  status?: number
): void {
  if (!isSentryEnabled()) return;

  const tags: Record<string, string> = { route, failure_kind: kind };
  if (status != null) tags.http_status = String(status);

  if (error instanceof Error) {
    // Keep only a short, generic message — drop long upstream dumps.
    const safe = new Error(error.name || "Error");
    safe.name = error.name || "Error";
    safe.message = truncateSafe(error.message);
    Sentry.captureException(safe, { tags });
    return;
  }

  Sentry.captureMessage(`api_failure:${route}:${kind}`, {
    level: "warning",
    tags,
  });
}

function truncateSafe(message: string): string {
  const cleaned = message.replace(/\s+/g, " ").trim();
  // Avoid shipping model/JSON dumps that sometimes land in Error.message
  if (cleaned.length > 160) return `${cleaned.slice(0, 160)}…`;
  return cleaned;
}
