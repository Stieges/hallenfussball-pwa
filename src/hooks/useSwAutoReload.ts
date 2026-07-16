/**
 * Wires the SW auto-reload-on-update flow into the React tree.
 *
 * The actual logic lives in `src/lib/swRegistration.ts` — this hook just
 * fetches the localized toast message and the showToast callback (both
 * only available inside the React tree) and forwards them. The dynamic
 * import of `virtual:pwa-register` keeps the SW registration out of the
 * initial bundle; in unit tests it resolves via the `vitest.config.ts`
 * `resolve.alias` to `src/test/mocks/virtual-pwa-register.ts` instead of
 * vite-plugin-pwa's real virtual module.
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useToast } from '../components/ui/Toast';
import { captureFeatureError } from '../lib/sentry';
import { setupSwAutoReload } from '../lib/swRegistration';

export function useSwAutoReload(): void {
  const { t } = useTranslation('auth');
  const { showInfo } = useToast();

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
        setupSwAutoReload({
          registerSW: mod.registerSW,
          showToast: (msg) => showInfo(msg),
          updatingMessage: t('login.appUpdating'),
        });
      } catch (err) {
        if (err instanceof Error) {
          captureFeatureError(err, 'sw', 'autoReloadSetup');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showInfo, t]);
}
