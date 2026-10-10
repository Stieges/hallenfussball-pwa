/**
 * @LZ-003 — „Turnier löschen" nur vor dem ersten Anpfiff.
 *
 * Angepfiffen = laufend, pausiert oder beendet. Ist der Zustand nicht
 * feststellbar (Laden fehlgeschlagen, offline, unvollständige Daten), wird die
 * Aktion ebenfalls nicht angeboten (fail-closed). Der reale Weg „zurück auf
 * Entwurf" heißt „Im Wizard bearbeiten" und lebt in SettingsTab — dort geprüft
 * (SettingsTab.wizardEditGate.test.tsx), hier nicht als Schein-Test.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Tournament } from '../../../../../types/tournament';

vi.mock('../../../../auth/hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: false }),
}));

vi.mock('../../../../auth/hooks/useTournamentMembers', () => ({
  useTournamentMembers: () => ({ myMembership: null, isLoading: false }),
}));

import { DangerZoneCategory } from '../index';

/** Match-Fixture mit bewusst freiem matchStatus-String (DB-Werte wie 'paused', Fehlerfälle). */
interface FixtureMatch {
  id: string;
  matchStatus?: string;
}

function tournamentWith(matches: FixtureMatch[] | undefined): Tournament {
  return {
    id: 't1', title: 'Wintercup', status: 'published',
    teams: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    matches,
    startDate: '2026-03-01', startTime: '10:00',
  } as unknown as Tournament;
}

function renderDangerZone(tournament: Tournament) {
  const onTournamentUpdate = vi.fn();
  render(
    <DangerZoneCategory
      tournamentId="t1"
      tournament={tournament}
      onTournamentUpdate={onTournamentUpdate}
      onLocalTournamentUpdate={vi.fn()}
      onMatchesUpdate={vi.fn()}
    />
  );
  return { onTournamentUpdate };
}

beforeEach(() => vi.clearAllMocks());

describe('DangerZone — „Turnier löschen" nur vor dem ersten Anpfiff', () => {
  it.each([
    ['@LZ-003', 'kein-Spiel-angepfiffen', 'angeboten', [{ id: 'm1', matchStatus: 'scheduled' }, { id: 'm2', matchStatus: 'scheduled' }]],
    ['@LZ-003', 'erstes-Gruppenspiel-angepfiffen', 'nicht angeboten', [{ id: 'm1', matchStatus: 'running' }, { id: 'm2', matchStatus: 'scheduled' }]],
    ['@LZ-003', 'laufendes-Spiel', 'nicht angeboten', [{ id: 'm1', matchStatus: 'running' }]],
    ['@LZ-003', 'pausiertes-Spiel', 'nicht angeboten', [{ id: 'm1', matchStatus: 'paused' }]],
    ['@LZ-003', 'beendetes-Spiel', 'nicht angeboten', [{ id: 'm1', matchStatus: 'finished' }]],
    ['@LZ-003', 'nur-geplante-Spiele', 'angeboten', [{ id: 'm1', matchStatus: 'scheduled' }, { id: 'm2', matchStatus: 'waiting' }, { id: 'm3', matchStatus: 'skipped' }]],
    ['@LZ-003', 'Match-Liste-fehlt-Laden-fehlgeschlagen', 'nicht angeboten', undefined],
    ['@LZ-003', 'matchStatus-fehlt-gilt-als-geplant', 'angeboten', [{ id: 'm1' }]],
    ['@LZ-003', 'matchStatus-unbekannt-nicht-feststellbar', 'nicht angeboten', [{ id: 'm1', matchStatus: 'irgendwas' }]],
  ] as [string, string, string, FixtureMatch[] | undefined][])('%s %s: „Turnier löschen" %s', (_kennung, _zeile, erwartung, matches) => {
    renderDangerZone(tournamentWith(matches));

    if (erwartung === 'angeboten') {
      expect(screen.getByRole('button', { name: /Turnier löschen/i })).toBeInTheDocument();
    } else {
      expect(screen.queryByRole('button', { name: /Turnier löschen/i })).not.toBeInTheDocument();
    }
  });
});
