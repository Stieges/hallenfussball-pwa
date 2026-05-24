import { describe, it } from 'vitest';

// =============================================================================
// PR 2 surface — SW update auto-reload handler (C1 in the sub-spec).
//
// Today: vite-plugin-pwa is configured with registerType: 'autoUpdate'. The
// SW installs in the background but the active page is NOT reloaded — the
// user sees the old bundle until the next tab open. HAR captures (2026-05-24)
// confirm: two bundle hashes loaded in the same session, with the stale one
// being the precached version.
//
// PR 2 switches vite-plugin-pwa to registerType: 'prompt' and adds
// src/lib/swRegistration.ts which:
//   - registers the SW with an onNeedRefresh callback
//   - shows a 2s toast ("App wird aktualisiert…")
//   - calls location.reload() to flush the precache
//   - records a Sentry breadcrumb with old vs. new build hash
//
// These .todo() markers convert 1:1 to it() in PR 2 against the real module.
// =============================================================================

describe('swRegistration.registerSWWithUpdate (PR 2)', () => {
  it.todo('registers the service worker on first call');
  it.todo(
    'invokes the showToast callback with the i18n key for "updating" when onNeedRefresh fires',
  );
  it.todo(
    'waits ~2s after the toast appears before calling location.reload() (gives users time to read)',
  );
  it.todo(
    'records a Sentry breadcrumb with the build hash before reload (lets us correlate which versions self-updated)',
  );
  it.todo('does not reload when onOfflineReady fires (only update path triggers reload)');
  it.todo(
    'when called twice (StrictMode double-invoke), only registers the SW once and reuses the existing registration',
  );
});
