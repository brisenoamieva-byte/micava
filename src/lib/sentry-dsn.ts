/** Shared DSN resolution. Empty/missing → SDK stays disabled (local-dev safe). */
export function resolveSentryDsn(): string | undefined {
  const dsn =
    process.env.SENTRY_DSN?.trim() ||
    process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() ||
    "";
  return dsn || undefined;
}

export function isSentryEnabled(): boolean {
  return Boolean(resolveSentryDsn());
}
