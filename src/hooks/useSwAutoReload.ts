/**
 * Wires the SW update flow into the React tree (C3b-2d, G8).
 *
 * The logic lives in `src/lib/swRegistration.ts` + `src/lib/swIdle.ts` — this
 * hook supplies what is only available inside the React tree: the toast for
 * the short moment before the idle reload (unchanged), the persistent notice
 * (`SwUpdateNotice`) with its immediate-reload button, the idle inputs
 * (modal dialog in the DOM + waiting outbox entries of the current account
 * from the match-engine context) and the outbox-status trigger
 * (`sender.subscribe`, see Fehlerpolitik 6 in `swRegistration.ts`). Without
 * an engine context only the dialog condition is checked (Fehlerregel 3). Context, `t` and `showInfo` are read
 * via refs at call time so identity changes (e.g. a language switch) are
 * picked up without re-running the setup — the setup effect runs once per
 * page load and relies on the module singleton (`swSetupSlots.ts`); its
 * cleanup deliberately does NOT dispose. The dynamic import of
 * `virtual:pwa-register` keeps the SW registration out of the initial bundle;
 * in unit tests it resolves via the `vitest.config.ts` `resolve.alias` to
 * `src/test/mocks/virtual-pwa-register.ts`.
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useToast } from '../components/ui/Toast';
import { countWaitingEntries } from '../features/collaboration/outbox/countWaitingEntries';
import { useMatchEngineContextOptional } from '../features/match-engine/useMatchEngineContext';
import type { SwAutoReloadHandle } from '../lib/swSetupSlots';
import { hasOpenModalDialog, isIdle } from '../lib/swIdle';
import { captureFeatureError } from '../lib/sentry';
import { setupSwAutoReload } from '../lib/swRegistration';

export interface SwAutoReloadState {
  /**
   * Knopf-Callback „Jetzt aktualisieren“ des persisten Hinweises,
   * `null` solange keine neue Version wartet.
   */
  updateNow: (() => void) | null;
}

export function useSwAutoReload(): SwAutoReloadState {
  const { t } = useTranslation('auth');
  const { showInfo } = useToast();
  const context = useMatchEngineContextOptional();
  const [updateNow, setUpdateNow] = useState<(() => void) | null>(null);

  const contextRef = useRef(context);
  contextRef.current = context;
  const tRef = useRef(t);
  tRef.current = t;
  const showInfoRef = useRef(showInfo);
  showInfoRef.current = showInfo;
  const maybeIdleRef = useRef<SwAutoReloadHandle['onMaybeIdle'] | null>(null);
  const sender = context?.sender ?? null;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        // Dynamic import, resolved at build time (typed natively via
        // vite-plugin-pwa/client, see src/vite-env.d.ts); test isolation is
        // handled by the vitest.config.ts alias, not by a runtime cast.
        const mod = await import('virtual:pwa-register');
        if (cancelled) {
          return;
        }
        const handle = setupSwAutoReload({
          registerSW: mod.registerSW,
          showToast: (msg) => {
            showInfoRef.current(msg);
          },
          updatingMessage: () => tRef.current('login.appUpdating'),
          isIdle: () =>
            isIdle({
              hasOpenModalDialog: () => hasOpenModalDialog(document),
              countWaiting: async () => {
                const ctx = contextRef.current;
                return ctx ? countWaitingEntries(ctx.store, ctx.accountId) : 0;
              },
              hasAccount: () => contextRef.current !== null,
            }),
          hasOpenModalDialog: () => hasOpenModalDialog(document),
          showUpdateNotice: (onUpdateNow) => {
            setUpdateNow(() => onUpdateNow);
          },
        });
        maybeIdleRef.current = handle.onMaybeIdle;
      } catch (err) {
        if (err instanceof Error) {
          captureFeatureError(err, 'sw', 'autoReloadSetup');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (sender === null) {
      return;
    }
    // Fehlerpolitik 6 (swRegistration.ts): Aufbau/Loesen bricht still ab.
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = sender.subscribe(() => {
        void maybeIdleRef.current?.();
      });
    } catch {
      return;
    }
    return () => {
      try {
        unsubscribe?.();
      } catch {
        // still — Fehlerpolitik 6
      }
    };
  }, [sender]);

  return { updateNow };
}
