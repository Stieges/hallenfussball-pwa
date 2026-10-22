/**
 * K2 (Befund C-COCKPIT-OFFLINEBANNER-VERDECKT-LEISTE, @SL-140): Im Cockpit-Rahmen rendert die Hülle der App weder die Offline- noch die
 * Speicher-Leiste (beide liegen fest am Rand und verdeckten die Daumenleiste); der schmale Kopf zeigt den Verbindungsstatus.
 * Außerhalb des Rahmens (Spielplan) bleiben sie. Fußzeile: nur ohne Rahmen (Ruling R-LT1).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppChrome } from '../AppChrome';
import { AppFooter } from '../layout/AppFooter';
import { useAnnounceCockpitFrame } from '../live-cockpit/frame/cockpitFrame';

vi.mock('../../lib/supabase', () => ({ isSupabaseConfigured: false, supabase: {} }));
vi.mock('../OfflineBanner', () => ({ OfflineBanner: () => <div data-testid="offline-banner" /> }));
vi.mock('../StorageWarningBanner', () => ({ StorageWarningBanner: () => <div data-testid="storage-warning" /> }));
vi.mock('../dialogs/ConsentDialog', () => ({ ConsentDialog: () => null }));
vi.mock('../layout/Footer', () => ({ Footer: () => <footer data-testid="app-footer" /> }));

function Rahmen({ aktiv }: { aktiv: boolean }) {
  useAnnounceCockpitFrame(aktiv);
  return <AppFooter />;
}

const zeige = (aktiv: boolean) => render(
  <MemoryRouter><AppChrome><Rahmen aktiv={aktiv} /></AppChrome></MemoryRouter>,
);

describe('K2 feste Leisten im Cockpit-Rahmen', () => {
  it('@SL-140 Rahmen aktiv: kein OfflineBanner, keine Speicher-Warnung, keine Fußzeile', () => {
    zeige(true);
    expect(screen.queryByTestId('offline-banner')).toBeNull();
    expect(screen.queryByTestId('storage-warning')).toBeNull();
    expect(screen.queryByTestId('app-footer')).toBeNull();
  });

  it('@SL-140 Gegenbeispiel (Spielplan-Reiter): ohne Rahmen zeigt die Hülle beide Leisten und die Fußzeile weiter', () => {
    zeige(false);
    expect(screen.getByTestId('offline-banner')).toBeInTheDocument();
    expect(screen.getByTestId('storage-warning')).toBeInTheDocument();
    expect(screen.getByTestId('app-footer')).toBeInTheDocument();
  });
});
