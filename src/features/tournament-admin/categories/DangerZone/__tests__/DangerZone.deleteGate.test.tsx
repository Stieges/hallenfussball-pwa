/**
 * @LZ-003 — „Turnier löschen" nur vor dem ersten Anpfiff.
 *
 * Angepfiffen = laufend, pausiert oder beendet. Ist der Zustand nicht
 * feststellbar (Laden fehlgeschlagen, offline, unvollständige Daten), wird die
 * Aktion ebenfalls nicht angeboten (fail-closed). „Festlegen zurücknehmen"
 * existiert im Code nicht als Angebot (grep 2026-10-03) und wird deshalb nur
 * als Nicht-Angebot geprüft.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('@LZ-003 Nach dem Anpfiff wird auch „Festlegen zurücknehmen" nicht angeboten', () => {
    renderDangerZone(tournamentWith([{ id: 'm1', matchStatus: 'running' }]));

    expect(screen.queryByRole('button', { name: /Festlegen zurücknehmen/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Festlegen zurücknehmen/i)).not.toBeInTheDocument();
  });

  it('@LZ-003 Serverfehler beim Löschen wird angezeigt (Gegenbeispiel: verschluckt)', async () => {
    const user = userEvent.setup();
    const onTournamentUpdate = vi.fn().mockRejectedValue(new Error('Server: 500'));
    render(
      <DangerZoneCategory
        tournamentId="t1"
        tournament={tournamentWith([{ id: 'm1', matchStatus: 'scheduled' }])}
        onTournamentUpdate={onTournamentUpdate}
        onLocalTournamentUpdate={vi.fn()}
        onMatchesUpdate={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /Turnier löschen/i }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByRole('textbox'), 'LÖSCHEN');
    await user.click(within(dialog).getByRole('button', { name: /Turnier löschen/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Server: 500/);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
