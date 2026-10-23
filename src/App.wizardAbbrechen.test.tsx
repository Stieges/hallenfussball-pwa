/**
 * C-ENTWURF-KIPPT-BEIM-ABBRECHEN: Wer ein Turnier über „Im Wizard bearbeiten“ öffnet und wieder abbricht,
 * lässt dessen Zustand, wie er war. Ein Entwurf bleibt Entwurf (@LZ-001: „angelegt, aber nicht festgelegt“
 * ist ein Entwurf), ein festgelegtes Turnier bleibt festgelegt (@W5-004, @LZ-004).
 * Szenarien: docs/anforderungen/2026-10-01_turnier-lebenszyklus.md, 2026-09-27_wizard-nach-dem-anlegen.md.
 * Bedienweg: Verwaltung -> onEditInWizard -> Wizard -> onBack (beide Bildschirme sind hier Attrappen, die
 * die Eigenschaften der App weiterreichen; geprüft wird, was die App speichert).
 */
import 'fake-indexeddb/auto';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tournament } from './types/tournament';

const { saveTournament } = vi.hoisted(() => ({ saveTournament: vi.fn() }));

vi.mock('./lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: { rpc: vi.fn().mockResolvedValue({ data: null, error: null }), from: vi.fn() },
}));
vi.mock('./hooks/useTournaments', () => ({
  useTournaments: () => ({
    tournaments: [],
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
  TournamentCreationScreen: (props: { onBack: () => void }) => (
    <button type="button" onClick={props.onBack}>wizard-abbrechen</button>
  ),
}));

import App from './App';

function turnier(status: 'draft' | 'published'): Tournament {
  return {
    id: 't1', title: 'Wintercup', status, teams: [], matches: [], updatedAt: '2026-10-01T08:00:00.000Z',
    publishedAt: status === 'published' ? '2026-10-01T08:00:00.000Z' : undefined,
  } as unknown as Tournament;
}

async function oeffneUndBrichAb(t: Tournament): Promise<void> {
  verwaltungsTurnier = t;
  render(<MemoryRouter initialEntries={['/tournament/t1']}><App /></MemoryRouter>);
  fireEvent.click(await screen.findByText('im-wizard-bearbeiten', {}, { timeout: 5000 }));
  fireEvent.click(await screen.findByText('wizard-abbrechen', {}, { timeout: 5000 }));
  await waitFor(() => expect(screen.queryByText('wizard-abbrechen')).toBeNull());
}

function gespeicherteStatus(): string[] {
  return saveTournament.mock.calls.map((aufruf) => (aufruf[0] as Tournament).status);
}

beforeEach(() => {
  vi.clearAllMocks();
  saveTournament.mockResolvedValue(undefined);
  vi.mocked(localStorage.getItem).mockReturnValue(null);
});

describe('Abbrechen im Wizard-Bearbeiten ändert den Zustand nicht (C-ENTWURF-KIPPT-BEIM-ABBRECHEN)', { timeout: 20_000 }, () => {
  it('@LZ-001 ein Entwurf bleibt nach „Im Wizard bearbeiten“ und Abbrechen ein Entwurf', async () => {
    await oeffneUndBrichAb(turnier('draft'));
    expect(gespeicherteStatus().length).toBeGreaterThan(0);
    expect(gespeicherteStatus()).not.toContain('published');
    expect((saveTournament.mock.calls.at(-1)?.[0] as Tournament).publishedAt).toBeUndefined();
  });

  it('@W5-004 Gegenbeispiel: ein festgelegtes Turnier bleibt nach Abbrechen festgelegt, mit seinem publishedAt', async () => {
    await oeffneUndBrichAb(turnier('published'));
    expect(gespeicherteStatus()).not.toContain('draft');
    const letzte = saveTournament.mock.calls.at(-1)?.[0] as Tournament;
    expect(letzte.status).toBe('published');
    expect(letzte.publishedAt).toBe('2026-10-01T08:00:00.000Z');
  });
});
