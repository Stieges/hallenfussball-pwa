/**
 * Compile-time build identifier injected by vite.config.ts via `define`.
 *
 * On Vercel: short SHA of the commit being deployed (8 chars).
 * Local dev: timestamp-based marker (`local-<base36>`).
 *
 * Used by Sentry release-tagging and boot-context telemetry to correlate
 * client errors with specific deploys. See vite.config.ts and
 * src/lib/sentry.ts (captureBootContext).
 */
declare const __BUILD_HASH__: string;
