/**
 * H4-8 Admin Center: Unterpunkt „Hallenton“ nur für Turnierleitung und Co-Admin (@HT-022), lesbar nach dem Turnierende (@HT-046).
 * Menüpunkt in Seitenleiste und mobilem Hub; direkte Adresse ohne Recht → „Ändern nur durch die Turnierleitung“.
 * Gegenbeispiele: alle anderen Kategorien bleiben für alle Rollen unverändert.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Tournament } from '../../../types/tournament';

vi.unmock('i18next');
vi.unmock('react-i18next');

const rolle = vi.hoisted(() => ({ aktuell: 'owner', mobil: false }));
vi.mock('../../auth/hooks/useMyTournamentRole', () => ({
  useMyTournamentRole: () => ({ role: rolle.aktuell, isLoading: false }),
}));
const turnier = { id: 'hallencup-sued', title: 'Hallencup Süd', teams: [], matches: [], numberOfFields: 2 } as unknown as Tournament;
vi.mock('../../../hooks/useTournamentManager', () => ({
  useTournamentManager: () => ({ tournament: turnier, handleTournamentUpdate: vi.fn(), applyRemote: vi.fn(), scheduleService: null, loadingError: null, reload: vi.fn() }),
}));
vi.mock('../../../hooks/useBreakpoint', () => ({ useBreakpoint: () => ({ isMobile: rolle.mobil }) }));
vi.mock('../components/AdminHeader', () => ({ AdminHeader: () => null }));
vi.mock('../categories/Hallenton', () => ({ HallentonCategory: () => <div data-testid="kategorie-hallenton" /> }));
vi.mock('../categories/Dashboard', () => ({ DashboardCategory: () => <div data-testid="kategorie-dashboard" /> }));
vi.mock('../categories/MatchCockpit', () => ({ MatchCockpitCategory: () => <div data-testid="kategorie-match-cockpit" /> }));

import { initRealDeI18n } from '../../../test/realDeI18n';
import { ToastProvider } from '../../../components/ui/Toast';
import { resetClosedTournaments, setTournamentClosed } from '../../../core/services/closedTournaments';
import { TournamentAdminCenter } from '../TournamentAdminCenter';

await initRealDeI18n();

function zeige(kategorie?: string) {
  render(
    <MemoryRouter><ToastProvider>
      <TournamentAdminCenter tournamentId="hallencup-sued" initialCategory={kategorie} onBackToTournament={vi.fn()} />
    </ToastProvider></MemoryRouter>,
  );
}

beforeEach(() => { rolle.aktuell = 'owner'; rolle.mobil = false; resetClosedTournaments(); });
afterEach(() => resetClosedTournaments());

describe('@HT-022 Menüpunkt in der Seitenleiste', () => {
  it.each(['owner', 'co-admin'])('%s sieht „Hallenton“ unter „Einstellungen“, nach „Match Cockpit“, mit „neu“', (r) => {
    rolle.aktuell = r;
    zeige('dashboard');
    const namen = screen.getAllByRole('button').map((b) => b.textContent ?? '');
    const cockpit = namen.findIndex((n) => n.includes('Match Cockpit'));
    const hallenton = namen.findIndex((n) => n.includes('Hallenton'));
    expect(hallenton).toBe(cockpit + 1);
    expect(screen.getByTestId('admin-neu-hallenton')).toHaveTextContent('neu');
  });
  it.each(['collaborator', 'helper', 'screen', 'viewer', 'trainer'])('%s sieht den Menüpunkt „Hallenton“ nicht, alle anderen bleiben', (r) => {
    rolle.aktuell = r;
    zeige('dashboard');
    expect(screen.queryByRole('button', { name: /Hallenton/ })).toBeNull();
    for (const name of ['Dashboard', 'Match Cockpit', 'Sichtbarkeit', 'Meta-Daten', 'Sponsoren']) {
      expect(screen.getByRole('button', { name: new RegExp(name) })).toBeInTheDocument();
    }
  });
});

describe('@HT-022 mobiler Hub', () => {
  beforeEach(() => { rolle.mobil = true; });
  it('Co-Admin sieht die Karte „Hallenton“ mit „Lautsprecher, Abpfiff, Halbzeit“ und „neu“', () => {
    rolle.aktuell = 'co-admin';
    zeige();
    expect(screen.getByRole('button', { name: /Hallenton/ })).toHaveTextContent('Lautsprecher, Abpfiff, Halbzeit');
    expect(screen.getByTestId('admin-neu-hallenton')).toBeInTheDocument();
  });
  it.each(['collaborator', 'helper', 'screen'])('%s: keine Karte „Hallenton“, auch nicht über die Suche; „Match Cockpit“ bleibt', (r) => {
    rolle.aktuell = r;
    zeige();
    expect(screen.queryByRole('button', { name: /Hallenton/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Cockpit/ })).toBeInTheDocument();
  });
  it('„Match Cockpit“ im Hub: Beschreibung ohne „Sound“', () => {
    zeige();
    expect(screen.getByRole('button', { name: /Cockpit/ })).not.toHaveTextContent(/Sound/);
  });
});

describe('@HT-022 direkte Adresse /admin/hallenton', () => {
  it.each(['owner', 'co-admin'])('%s sieht den Unterpunkt', async (r) => {
    rolle.aktuell = r;
    zeige('hallenton');
    expect(await screen.findByTestId('kategorie-hallenton')).toBeInTheDocument();
    expect(screen.queryByTestId('lead-only-hint')).toBeNull();
  });
  it.each(['collaborator', 'helper', 'screen'])('%s: „Ändern nur durch die Turnierleitung“ statt des Unterpunkts', async (r) => {
    rolle.aktuell = r;
    zeige('hallenton');
    expect(await screen.findByTestId('lead-only-hint')).toHaveTextContent('Ändern nur durch die Turnierleitung');
    expect(screen.queryByTestId('kategorie-hallenton')).toBeNull();
  });
});

describe('@HT-046 nach dem Turnierende', () => {
  it('Turnierleitung und Co-Admin: der Menüpunkt „Hallenton“ steht auch nach dem Ende in Seitenleiste und Hub, Ändern bleibt Sache der Tasten', () => {
    setTournamentClosed('hallencup-sued', true);
    for (const r of ['owner', 'co-admin']) {
      rolle.aktuell = r;
      rolle.mobil = false;
      const a = render(<MemoryRouter><ToastProvider><TournamentAdminCenter tournamentId="hallencup-sued" initialCategory="dashboard" onBackToTournament={vi.fn()} /></ToastProvider></MemoryRouter>);
      expect(screen.getByRole('button', { name: /Hallenton/ })).toBeInTheDocument();
      a.unmount();
      rolle.mobil = true;
      const b = render(<MemoryRouter><ToastProvider><TournamentAdminCenter tournamentId="hallencup-sued" onBackToTournament={vi.fn()} /></ToastProvider></MemoryRouter>);
      expect(screen.getByRole('button', { name: /Hallenton/ })).toBeInTheDocument();
      b.unmount();
    }
  });
  it('Gegenbeispiel: Helfer, Helfer-Zugang, Bildschirm sehen den Menüpunkt auch nach dem Ende nicht (Seitenleiste und Hub)', () => {
    setTournamentClosed('hallencup-sued', true);
    for (const r of ['collaborator', 'helper', 'screen']) {
      rolle.aktuell = r;
      rolle.mobil = false;
      const a = render(<MemoryRouter><ToastProvider><TournamentAdminCenter tournamentId="hallencup-sued" initialCategory="dashboard" onBackToTournament={vi.fn()} /></ToastProvider></MemoryRouter>);
      expect(screen.queryByRole('button', { name: /Hallenton/ })).toBeNull();
      a.unmount();
      rolle.mobil = true;
      const b = render(<MemoryRouter><ToastProvider><TournamentAdminCenter tournamentId="hallencup-sued" onBackToTournament={vi.fn()} /></ToastProvider></MemoryRouter>);
      expect(screen.queryByRole('button', { name: /Hallenton/ })).toBeNull();
      b.unmount();
    }
  });
  it('Turnierleitung: der Unterpunkt bleibt zum Lesen offen (kein Abschluss-Sperrhinweis)', async () => {
    setTournamentClosed('hallencup-sued', true);
    zeige('hallenton');
    expect(await screen.findByTestId('kategorie-hallenton')).toBeInTheDocument();
    expect(screen.queryByTestId('tournament-closed-hint')).toBeNull();
  });
  it('Gegenbeispiel: Helfer nach dem Abschluss → weiter „Ändern nur durch die Turnierleitung“, nicht der Abschluss-Hinweis', async () => {
    rolle.aktuell = 'collaborator';
    setTournamentClosed('hallencup-sued', true);
    zeige('hallenton');
    expect(await screen.findByTestId('lead-only-hint')).toBeInTheDocument();
    expect(screen.queryByTestId('tournament-closed-hint')).toBeNull();
  });
  it('Gegenbeispiel: „Match Cockpit“ bleibt nach dem Abschluss gesperrt (Abschluss-Hinweis), wie vorher', async () => {
    setTournamentClosed('hallencup-sued', true);
    zeige('match-cockpit');
    expect(await screen.findByTestId('tournament-closed-hint')).toBeInTheDocument();
    expect(screen.queryByTestId('kategorie-match-cockpit')).toBeNull();
  });
});
