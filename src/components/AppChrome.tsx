/**
 * Globale Hülle der App (B-19a, @ME-003, @OB-028). Auf Kiosk-Routen (Monitor) entfallen Speicherwarnung,
 * Offline-Hinweis, Einwilligung, Update-Hinweis und Toasts; nichts wartet auf eine Eingabe. Verwaltung und
 * Cockpit bleiben unverändert.
 */
import { useCallback, useState, type ReactNode } from 'react';
import { ToastProvider } from './ui/Toast';
import { ErrorBoundary } from './ErrorBoundary';
import { StorageWarningBanner } from './StorageWarningBanner';
import { OfflineBanner } from './OfflineBanner';
import { SwUpdateNotice } from './SwUpdateNotice';
import { ConsentDialog } from './dialogs/ConsentDialog';
import { useKioskRoute } from '../hooks/useKioskRoute';
import { hasConsent } from '../lib/consent';
import { reinitializeSentry } from '../lib/sentry';

/** Persistenter Update-Hinweis (C3b-2d, G8). Auf Kiosk-Routen nie (@ME-003). */
export function SwUpdateNoticeSlot({ updateNow }: { updateNow: (() => void) | null }) {
  const kiosk = useKioskRoute();
  if (updateNow === null || kiosk) {
    return null;
  }
  return <SwUpdateNotice onUpdateNow={updateNow} />;
}

export function AppChrome({ children }: { children: ReactNode }) {
  const kiosk = useKioskRoute();
  // DSGVO Consent Dialog - shows on first visit
  const [showConsentDialog, setShowConsentDialog] = useState(() => !hasConsent());

  const handleConsent = useCallback(() => {
    setShowConsentDialog(false);
    // Re-initialize Sentry with new consent status
    void reinitializeSentry();
  }, []);

  return (
    <ToastProvider suppressed={kiosk}>
      <ErrorBoundary onReset={() => { window.location.hash = '#/'; }}>
        {!kiosk && <StorageWarningBanner />}
        {!kiosk && <OfflineBanner />}
        {children}
      </ErrorBoundary>
      {/* DSGVO Consent Dialog - OUTSIDE ErrorBoundary for crash recovery */}
      {!kiosk && <ConsentDialog isOpen={showConsentDialog} onConsent={handleConsent} />}
    </ToastProvider>
  );
}
