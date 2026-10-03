/**
 * @LZ-003 / W3 (Fixrunde 1) — „Im Wizard bearbeiten" nur vor dem ersten Anpfiff.
 *
 * „Im Wizard bearbeiten" (hier: „Erweiterte Bearbeitung" mit den Buttons
 * Teams/Spielmodus/Gruppen & Felder) setzt das Turnier per handleEditInWizard auf
 * Entwurf zurück — derselbe Weg wie „Festlegen zurücknehmen". Nach dem ersten
 * Anpfiff wird dieser Weg nicht angeboten (gleiche Sperre wie „Turnier löschen",
 * gemeinsame Funktion statt Kopie).
 *
 * Test:    nach Anpfiff nicht angeboten.
 * Gegenbeispiel: vor dem Anpfiff angeboten.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';

vi.mock('../../auth/hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: false }),
}));

vi.mock('../../auth/hooks/useTournamentMembers', () => ({
  useTournamentMembers: () => ({ myMembership: null, isLoading: false }),
}));

import { SettingsTab } from '../SettingsTab';

function tournamentWith(statuses: Array<string | undefined>): Tournament {
  return {
    id: 't1', title: 'Wintercup', status: 'published',
    teams: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    matches: statuses.map((matchStatus, index) => ({ id: `m${index + 1}`, matchStatus })),
    startDate: '2026-03-01', startTime: '10:00',
    ageClass: 'U11',
    location: { name: 'Halle Süd', city: 'Musterstadt' },
    placementLogic: [],
  } as unknown as Tournament;
}

function renderSettings(tournament: Tournament) {
  render(
    <SettingsTab
      tournament={tournament}
      onTournamentUpdate={vi.fn()}
      onEditInWizard={vi.fn()}
    />
  );
}

beforeEach(() => vi.clearAllMocks());

describe('SettingsTab — „Im Wizard bearbeiten" nur vor dem ersten Anpfiff (@LZ-003, W3)', () => {
  it('@LZ-003 „Im Wizard bearbeiten" ist nach dem Anpfiff nicht angeboten', () => {
    renderSettings(tournamentWith(['running', 'scheduled']));

    expect(
      screen.queryByRole('button', { name: /settings\.advancedEditing\.editTeams/ })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /settings\.advancedEditing\.changeGameMode/ })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /settings\.advancedEditing\.groupsAndFields/ })
    ).not.toBeInTheDocument();
  });

  it('Gegenbeispiel: vor dem Anpfiff wird „Im Wizard bearbeiten" angeboten', () => {
    renderSettings(tournamentWith(['scheduled', 'scheduled']));

    expect(
      screen.getByRole('button', { name: /settings\.advancedEditing\.editTeams/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /settings\.advancedEditing\.changeGameMode/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /settings\.advancedEditing\.groupsAndFields/ })
    ).toBeInTheDocument();
  });
});
