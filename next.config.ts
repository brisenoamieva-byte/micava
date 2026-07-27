import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import path from "path";

const nextConfig: NextConfig = {
  // Avoid picking up C:\Users\brise\package-lock.json as monorepo root
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default withSentryConfig(nextConfig, {
  // Source maps upload (optional). Set in Vercel/CI only — never commit tokens.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  silent: !process.env.CI,
  widenClientFileUpload: true,
  // Route browser events through Next to reduce ad-blocker drops
  tunnelRoute: "/monitoring",
});
