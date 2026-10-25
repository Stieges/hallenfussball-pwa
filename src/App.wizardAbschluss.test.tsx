/**
 * R3-3 Wizard-Neuplanung (Einstieg in alle 5 Schritte) nach dem Abschluss. @LZ-036 „bietet die App das nicht an“, @ZP-087.
 * Bedienweg wie App.wizardAbbrechen.test.tsx: Verwaltung und Wizard sind Attrappen, geprüft wird, was die App daraus macht.
 */
import 'fake-indexeddb/auto';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tournament } from './types/tournament';

const { saveTournament, liste } = vi.hoisted(() => ({ saveTournament: vi.fn(), liste: { current: [] as unknown[] } }));

vi.mock('./lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: { rpc: vi.fn().mockResolvedValue({ data: null, error: null }), from: vi.fn() },
}));
vi.mock('./hooks/useTournaments', () => ({
  useTournaments: () => ({
    tournaments: liste.current,
    loading: false,
    saveTournament,
    deleteTournament: vi.fn(),
    softDeleteTournament: vi.fn(),
    restoreTournament: vi.fn(),
    permanentDeleteTournament: vi.fn(),
  }),
}));

// Verwaltung: ein Knopf, der „Im Wizard bearbeiten“ für das Turnier der Aufgabe auslöst.
let verwaltungsTurnier: Tournament;
vi.mock('./screens/TournamentManagementScreen', () => ({
  TournamentManagementScreen: (props: { onEditInWizard: (t: Tournament, step?: number) => void }) => (
    <button type="button" onClick={() => props.onEditInWizard(verwaltungsTurnier, 3)}>im-wizard-bearbeiten</button>
  ),
}));
// Wizard: ein Knopf, der „Abbrechen“ (onBack) auslöst.
vi.mock('./screens/TournamentCreationScreen', () => ({
  TournamentCreationScreen: () => <div data-testid="wizard-stub" />,
}));

import App from './App';
import { resetClosedTournaments } from './core/services/closedTournaments';

function turnier(lifecycleStatus: 'fixed' | 'finished'): Tournament {
  return {
    id: 't1', title: 'Wintercup', status: 'published', lifecycleStatus, teams: [], matches: [],
    updatedAt: '2026-10-01T08:00:00.000Z', publishedAt: '2026-10-01T08:00:00.000Z',
  } as unknown as Tournament;
}

function oeffne(pfad: string, t: Tournament) {
  liste.current = [t];
  verwaltungsTurnier = t;
  render(<MemoryRouter initialEntries={[pfad]}><App /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  resetClosedTournaments();
  saveTournament.mockResolvedValue(undefined);
  vi.mocked(localStorage.getItem).mockReturnValue(null);
});

describe('R3-3 Wizard-Neuplanung nach dem Abschluss (@LZ-036, @ZP-087; alle 5 Schritte)', { timeout: 20_000 }, () => {
  it('abgeschlossen: /tournament/:id/edit öffnet den Wizard nicht, es steht der Hinweis mit Weg zurück', async () => {
    oeffne('/tournament/t1/edit', turnier('finished'));
    expect(await screen.findByTestId('wizard-closed-notice', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.queryByTestId('wizard-stub')).not.toBeInTheDocument();
    expect(screen.getByTestId('tournament-closed-hint')).toBeInTheDocument();
    expect(screen.getByTestId('wizard-closed-back')).toBeInTheDocument();
    // Review #394 m-3: eine Überschrift mit Fokus, genau eine Live-Region, Haupttaste nur die Zurück-Taste
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(within(screen.getByTestId('wizard-closed-notice')).getAllByRole('status')).toHaveLength(1);
    expect(document.querySelectorAll('[data-primary]')).toHaveLength(1);
  });

  it('abgeschlossen: auch mit Schritt (?step=5, „Teams bearbeiten“) kein Wizard', async () => {
    oeffne('/tournament/t1/edit?step=5', turnier('finished'));
    expect(await screen.findByTestId('wizard-closed-notice', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.queryByTestId('wizard-stub')).not.toBeInTheDocument();
  });

  it('abgeschlossen: „Im Wizard bearbeiten“ aus der Verwaltung speichert nichts und öffnet nichts', async () => {
    oeffne('/tournament/t1', turnier('finished'));
    fireEvent.click(await screen.findByText('im-wizard-bearbeiten', {}, { timeout: 5000 }));
    await waitFor(() => expect(screen.queryByTestId('wizard-stub')).not.toBeInTheDocument());
    expect(saveTournament).not.toHaveBeenCalled();
    expect(screen.getByText('im-wizard-bearbeiten')).toBeInTheDocument();
  });

  it('Gegenbeispiel: offen – /edit öffnet den Wizard, „Im Wizard bearbeiten“ speichert und öffnet ihn', async () => {
    oeffne('/tournament/t1/edit', turnier('fixed'));
    expect(await screen.findByTestId('wizard-stub', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.queryByTestId('wizard-closed-notice')).not.toBeInTheDocument();
  });

  it('Gegenbeispiel: offen – aus der Verwaltung öffnet „Im Wizard bearbeiten“ den Wizard', async () => {
    oeffne('/tournament/t1', turnier('fixed'));
    fireEvent.click(await screen.findByText('im-wizard-bearbeiten', {}, { timeout: 5000 }));
    expect(await screen.findByTestId('wizard-stub', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(saveTournament).toHaveBeenCalled();
  });
});
