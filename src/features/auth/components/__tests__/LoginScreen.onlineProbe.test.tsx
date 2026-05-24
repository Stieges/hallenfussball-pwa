import { describe, it } from 'vitest';

// =============================================================================
// PR 2 surface — resilient online detection (C2 in the sub-spec).
//
// Today: useBrowserOnlineStatus() in LoginScreen.tsx trusts navigator.onLine's
// initial value. If the browser/OS reports a false-negative on mount (a known
// issue after SW startup with cache-hit), the loud OfflineBanner persists for
// the rest of the session.
//
// PR 2 adds a one-shot HEAD probe against the Supabase auth health endpoint
// when navigator.onLine === false at mount, and trusts the probe over the
// initial flag.
//
// These .todo() markers convert 1:1 to it() in PR 2 against the real probe
// implementation. They intentionally don't reference modules that don't exist
// yet — that would block PR 1 from importing.
// =============================================================================

describe('LoginScreen — online probe (PR 2)', () => {
  it.todo('does not render the loud OfflineBanner when navigator.onLine === true');
  it.todo(
    'when navigator.onLine === false but probe HEAD /auth/v1/health returns 200, sets browserOnline=true and suppresses the loud banner',
  );
  it.todo(
    'when navigator.onLine === false and probe fails or times out (3s), keeps browserOnline=false and renders the loud banner',
  );
  it.todo('runs the probe at most once per component lifecycle (no polling)');
  it.todo(
    'records a Sentry breadcrumb when navigator.onLine disagrees with the probe result (false-negative observability)',
  );
});
