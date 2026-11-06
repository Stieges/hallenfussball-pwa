/**
 * Globale Hülle der App (B-19a, @ME-003, @OB-028). Auf Kiosk-Routen (Monitor) entfallen Speicherwarnung,
 * Offline-Hinweis, Update-Hinweis und Toasts; nichts wartet auf eine Eingabe. Verwaltung und
 * Cockpit bleiben unverändert. Keine Einwilligungsabfrage (@RE-001): nichts liegt über dem Einstieg.
 */
import type { ReactNode } from 'react';
import { ToastProvider } from './ui/Toast';
import { ErrorBoundary } from './ErrorBoundary';
import { StorageWarningBanner } from './StorageWarningBanner';
import { OfflineBanner } from './OfflineBanner';
import { SwUpdateNotice } from './SwUpdateNotice';
import { useKioskRoute } from '../hooks/useKioskRoute';
import { CockpitFrameProvider } from './live-cockpit/frame/CockpitFrameContext';
import { useCockpitFrame } from './live-cockpit/frame/cockpitFrame';

/** Persistenter Update-Hinweis (C3b-2d, G8). Auf Kiosk-Routen nie (@ME-003). */
export function SwUpdateNoticeSlot({ updateNow }: { updateNow: (() => void) | null }) {
  const kiosk = useKioskRoute();
  if (updateNow === null || kiosk) {
    return null;
  }
  return <SwUpdateNotice onUpdateNow={updateNow} />;
}

/**
 * Feste Hinweisleisten (Speicher, Offline): Im Cockpit-Rahmen (@SL-140) entfallen sie, die Daumenleiste ist die einzige feste Leiste
 * (C-COCKPIT-OFFLINEBANNER-VERDECKT-LEISTE); der schmale Kopf zeigt den Verbindungsstatus.
 */
function FesteHinweise({ kiosk }: { kiosk: boolean }) {
  const { vollbild } = useCockpitFrame();
  if (kiosk || vollbild) { return null; }
  return (
    <>
      <StorageWarningBanner />
      <OfflineBanner />
    </>
  );
}

export function AppChrome({ children }: { children: ReactNode }) {
  return (
    <CockpitFrameProvider>
      <AppChromeInner>{children}</AppChromeInner>
    </CockpitFrameProvider>
  );
}

function AppChromeInner({ children }: { children: ReactNode }) {
  const kiosk = useKioskRoute();
  return (
    <ToastProvider suppressed={kiosk}>
      <ErrorBoundary onReset={() => { window.location.hash = '#/'; }}>
        <FesteHinweise kiosk={kiosk} />
        {children}
      </ErrorBoundary>
    </ToastProvider>
  );
}
