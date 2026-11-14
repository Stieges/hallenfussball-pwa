/**
 * Befund C-BEARBEITEN-SPEICHERT-VERALTETE-KOPIE -- @W5-039 (docs/anforderungen/2026-09-27_wizard-nach-dem-anlegen.md), Weg
 * „Im Wizard bearbeiten“ in den Einstellungen der Verwaltung: der Einstieg speichert nichts, der Zielschritt steht in der Adresse
 * (`?step=`), und der Assistent bekommt den frisch geladenen Stand, nie die (evtl. ältere) Kopie der Verwaltung.
 * Verwaltung und Assistent sind Attrappen, geprüft wird, was die App speichert und weiterreicht.
 *
 * Mutation: in App.tsx `handleEditInWizard` den Aufruf `await saveTournament(tournament)` zurückholen -> die ersten beiden Tests werden rot.
 */
import 'fake-indexeddb/auto';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tournament } from './types/tournament';

const { saveTournament, serverStand } = vi.hoisted(() => ({
  saveTournament: vi.fn(),
  serverStand: { current: null },
}));

vi.mock('./lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: { rpc: vi.fn().mockResolvedValue({ data: null, error: null }), from: vi.fn() },
}));
vi.mock('./hooks/useTournaments', () => ({
  useTournaments: () => ({
    tournaments: [], loading: false, saveTournament, deleteTournament: vi.fn(), softDeleteTournament: vi.fn(),
    restoreTournament: vi.fn(), permanentDeleteTournament: vi.fn(),
  }),
}));
vi.mock('./hooks/useRepository', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./hooks/useRepository')>()),
  useRepository: () => ({ get: () => Promise.resolve(serverStand.current) }),
}));

let verwaltungsTurnier: Tournament;
let zielSchritt: number | undefined;
vi.mock('./screens/TournamentManagementScreen', () => ({
  TournamentManagementScreen: (props: { onEditInWizard: (t: Tournament, step?: number) => void }) => (
    <button type="button" onClick={() => props.onEditInWizard(verwaltungsTurnier, zielSchritt)}>im-wizard-bearbeiten</button>
  ),
}));
vi.mock('./screens/TournamentCreationScreen', () => ({
  TournamentCreationScreen: (props: { existingTournament?: Tournament }) => {
    const location = useLocation();
    return (
      <div data-testid="wizard-stub">
        <span data-testid="wizard-titel">{props.existingTournament?.title}</span>
        <span data-testid="wizard-teams">{props.existingTournament?.teams.length}</span>
        <span data-testid="wizard-adresse">{location.pathname + location.search}</span>
      </div>
    );
  },
}));

import App from './App';

function turnier(title: string, teams: number, status: 'draft' | 'published' = 'published'): Tournament {
  return {
    id: 't1', title, status, teams: Array.from({ length: teams }, (_, i) => ({ id: `team${i}`, name: `Team ${i}` })), matches: [],
    updatedAt: '2026-10-01T08:00:00.000Z',
  } as unknown as Tournament;
}

async function oeffne(verwaltung: Tournament, server: Tournament, schritt?: number): Promise<void> {
  verwaltungsTurnier = verwaltung;
  serverStand.current = server as never;
  zielSchritt = schritt;
  render(<MemoryRouter initialEntries={['/tournament/t1']}><App /></MemoryRouter>);
  fireEvent.click(await screen.findByText('im-wizard-bearbeiten', {}, { timeout: 20_000 }));
  await screen.findByTestId('wizard-stub', {}, { timeout: 20_000 });
}

beforeEach(() => {
  vi.clearAllMocks();
  saveTournament.mockResolvedValue(undefined);
  vi.mocked(localStorage.getItem).mockReturnValue(null);
});

describe('„Im Wizard bearbeiten“ speichert beim Öffnen nichts (@W5-039)', { timeout: 60_000 }, () => {
  it('Kopie ohne wartende Änderung: kein Speichern, der Zielschritt kommt aus der Adresse', async () => {
    await oeffne(turnier('Cup', 6), turnier('Cup', 6), 5);
    expect(saveTournament).not.toHaveBeenCalled();
    expect(screen.getByTestId('wizard-adresse')).toHaveTextContent('/tournament/t1/edit?step=5');
  });

  it('ältere Kopie als der Server: kein Speichern, der Assistent zeigt den Stand des Servers (6 Teams), nicht die Kopie (0 Teams)', async () => {
    await oeffne(turnier('Alt', 0), turnier('Neu vom Server', 6), 3);
    expect(saveTournament).not.toHaveBeenCalled();
    expect(screen.getByTestId('wizard-titel')).toHaveTextContent('Neu vom Server');
    expect(screen.getByTestId('wizard-teams')).toHaveTextContent('6');
  });

  it('Gegenbeispiel: ohne Zielschritt bleibt die Adresse ohne ?step= (bisheriger Einstieg)', async () => {
    await oeffne(turnier('Cup', 6), turnier('Cup', 6));
    expect(screen.getByTestId('wizard-adresse')).toHaveTextContent(/^\/tournament\/t1\/edit$/);
    expect(saveTournament).not.toHaveBeenCalled();
  });
});
