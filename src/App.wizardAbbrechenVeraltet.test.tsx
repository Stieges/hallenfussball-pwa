/**
 * Fixrunde PR #516 (Opus 🔴2), Fehlerklasse C-ENTWURF-WIEDEROEFFNEN-LOESCHT-TEAMS: „Abbrechen“ im Assistenten schreibt den Stand
 * zurück, den „Im Wizard bearbeiten“ gehalten hat. Blieb er nach Browser-Zurück stehen, überschrieb das Abbrechen eines ANDEREN
 * Assistenten (anderer Entwurf, auch /tournament/new) das erste Turnier mit dem Stand vom ersten Öffnen.
 * Szenarien: docs/anforderungen/2026-09-27_wizard-nach-dem-anlegen.md (@W5-039); @LZ-001/@W5-004 „Abbrechen ändert den Zustand
 * nicht“ bleibt in App.wizardAbbrechen.test.tsx.
 *
 * Mutation: den Effekt `if (!isEditWizardPath) { setSelectedTournament(null); … }` und die Kennungsprüfung im Abbrechen
 * (`selectedTournament.id === editingTournamentId`) aus App.tsx entfernen -> der erste Test wird rot.
 */
import 'fake-indexeddb/auto';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tournament } from './types/tournament';

const { saveTournament } = vi.hoisted(() => ({ saveTournament: vi.fn() }));

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
// Der zweite Entwurf lädt über das Repository (nie aus der Liste)
vi.mock('./hooks/useRepository', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./hooks/useRepository')>()),
  useRepository: () => ({ get: (id: string) => Promise.resolve(id === 'd2' ? entwurf('d2', 'Zweiter Entwurf') : null) }),
}));

let verwaltungsTurnier: Tournament;
vi.mock('./screens/TournamentManagementScreen', () => ({
  TournamentManagementScreen: (props: { onEditInWizard: (t: Tournament, step?: number) => void }) => {
    const navigate = useNavigate();
    return (
      <div>
        <button type="button" onClick={() => props.onEditInWizard(verwaltungsTurnier, 3)}>im-wizard-bearbeiten</button>
        <button type="button" onClick={() => void navigate('/tournament/d2/edit')}>anderen-entwurf-oeffnen</button>
        <button type="button" onClick={() => void navigate('/tournament/new')}>neues-turnier</button>
      </div>
    );
  },
}));
vi.mock('./screens/TournamentCreationScreen', () => ({
  TournamentCreationScreen: (props: { onBack: () => void }) => {
    const navigate = useNavigate();
    return (
      <div>
        <button type="button" onClick={props.onBack}>wizard-abbrechen</button>
        <button type="button" onClick={() => void navigate(-1)}>browser-zurueck</button>
      </div>
    );
  },
}));

import App from './App';

function entwurf(id: string, title: string): Tournament {
  return { id, title, status: 'draft', teams: [], matches: [], updatedAt: '2026-10-01T08:00:00.000Z' } as unknown as Tournament;
}

async function oeffneVerwaltungUndWizard(): Promise<void> {
  verwaltungsTurnier = entwurf('t1', 'Alt');
  render(<MemoryRouter initialEntries={['/', '/tournament/t1']} initialIndex={1}><App /></MemoryRouter>);
  fireEvent.click(await screen.findByText('im-wizard-bearbeiten', {}, { timeout: 20_000 }));
  await screen.findByText('browser-zurueck', {}, { timeout: 20_000 });
  saveTournament.mockClear(); // „Im Wizard bearbeiten“ speichert beim Öffnen (Vorbedingung, nicht der Gegenstand)
  fireEvent.click(screen.getByText('browser-zurueck')); // Browser-Zurück: kein „Abbrechen“, die App setzt nichts selbst zurück
  await screen.findByText('anderen-entwurf-oeffnen', {}, { timeout: 20_000 });
}

beforeEach(() => {
  vi.clearAllMocks();
  saveTournament.mockResolvedValue(undefined);
  vi.mocked(localStorage.getItem).mockReturnValue(null);
});

describe('Abbrechen schreibt nie den gehaltenen Stand eines früheren Öffnens zurück (@W5-039, Fehlerklasse Voll-Ersatz)', { timeout: 60_000 }, () => {
  it('Verwaltung t1 → bearbeiten → Browser-Zurück → anderen Entwurf öffnen → Abbrechen: t1 wird nicht mit „Alt“ überschrieben', async () => {
    await oeffneVerwaltungUndWizard();
    fireEvent.click(screen.getByText('anderen-entwurf-oeffnen'));
    fireEvent.click(await screen.findByText('wizard-abbrechen', {}, { timeout: 20_000 }));
    await waitFor(() => expect(screen.queryByText('wizard-abbrechen')).toBeNull(), { timeout: 20_000 });
    expect(saveTournament.mock.calls.map((aufruf) => (aufruf[0] as Tournament).id)).not.toContain('t1');
    expect(saveTournament).not.toHaveBeenCalled();
  });

  it('dasselbe über /tournament/new (der Abbrechen-Weg wird gemeinsam genutzt)', async () => {
    await oeffneVerwaltungUndWizard();
    fireEvent.click(screen.getByText('neues-turnier'));
    fireEvent.click(await screen.findByText('wizard-abbrechen', {}, { timeout: 20_000 }));
    await waitFor(() => expect(screen.queryByText('wizard-abbrechen')).toBeNull(), { timeout: 20_000 });
    expect(saveTournament).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: normales Abbrechen nach „Im Wizard bearbeiten“ stellt den Stand von vorher wieder her (@LZ-001)', async () => {
    verwaltungsTurnier = entwurf('t1', 'Alt');
    render(<MemoryRouter initialEntries={['/tournament/t1']}><App /></MemoryRouter>);
    fireEvent.click(await screen.findByText('im-wizard-bearbeiten', {}, { timeout: 20_000 }));
    fireEvent.click(await screen.findByText('wizard-abbrechen', {}, { timeout: 20_000 }));
    await waitFor(() => expect(screen.queryByText('wizard-abbrechen')).toBeNull(), { timeout: 20_000 });
    const letzte = saveTournament.mock.calls.at(-1)?.[0] as Tournament;
    expect(letzte).toMatchObject({ id: 't1', title: 'Alt', status: 'draft' });
  });
});
