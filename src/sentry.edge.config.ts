import * as Sentry from "@sentry/nextjs";
import { isSentryEnabled, resolveSentryDsn } from "@/lib/sentry-dsn";

const dsn = resolveSentryDsn();

Sentry.init({
  dsn,
  enabled: isSentryEnabled(),
  environment:
    process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
  tracesSampleRate: process.env.NODE_ENV === "development" ? 0 : 0.1,
  sendDefaultPii: false,
});
