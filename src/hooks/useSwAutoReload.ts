/**
 * Wires the SW auto-reload-on-update flow into the React tree.
 *
 * The actual logic lives in `src/lib/swRegistration.ts` — this hook just
 * fetches the localized toast message and the showToast callback (both
 * only available inside the React tree) and forwards them. The dynamic
 * import of `virtual:pwa-register` keeps unit tests free of the virtual
 * module dependency.
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
        // Dynamic import avoids pulling vite-plugin-pwa's virtual module
        // into unit tests (where it doesn't exist).
        const mod = (await import(/* @vite-ignore */ 'virtual:pwa-register')) as {
          registerSW: Parameters<typeof setupSwAutoReload>[0]['registerSW'];
        };
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
