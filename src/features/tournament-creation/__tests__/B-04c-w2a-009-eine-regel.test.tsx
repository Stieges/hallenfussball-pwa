/**
 * B-04 Paket c — @W2A-009: Es gibt genau eine Entscheidungsregel.
 *
 * Gegeben ein K.-o.-Spiel endet unentschieden
 * Wenn Spielsteuerung, Monitor und Server die Entscheidung bestimmen
 * Dann verwenden alle dieselbe eingestellte Regel
 *
 * Echter Bedienweg: Oberfläche (FinalsConfiguration) → gespeichertes Turnier →
 * beide Konsumenten ermitteln die Regel:
 *   - Spielsteuerung/Cockpit: MatchExecutionService.initializeMatch schreibt
 *     `tiebreakerMode` (genau das, was das Cockpit nach dem Unentschieden anzeigt)
 *   - Monitor: toLiveMatch (src/features/monitor-display/monitorMatch.ts)
 * Beide rufen DIESELBE exportierte Funktion (`resolveTiebreakMode`) — per Spy
 * auf das Modul geprüft. Die SQL-Seite (match_engine.server_rules) prüft
 * `scripts/append-match-events-check.sh` am gemeinsamen Vertrags-Fixture
 * `src/core/match/__contracts__/server-rules-ko-entscheidung.json`.
 *
 * UI-Ort: src/features/tournament-creation/components/FinalsConfiguration.tsx
 * (Einstellung), src/features/monitor-display/monitorMatch.ts (Monitor).
 *
 * Mutation: eine zweite, abweichende Ermittlung in einem Konsumenten → rot.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useTournamentWizard } from '../../../hooks/useTournamentWizard';
import { FinalsConfiguration } from '../components/FinalsConfiguration';
import { MatchExecutionService } from '../../../core/services/MatchExecutionService';
import { toLiveMatch } from '../../../features/monitor-display/monitorMatch';
import type { ILiveMatchRepository } from '../../../core/repositories/ILiveMatchRepository';
import type { ITournamentRepository } from '../../../core/repositories/ITournamentRepository';
import type { ScheduledMatch } from '../../../core/generators';
import type { Match, Team, Tournament, TiebreakerMode, KnockoutRound } from '../../../types/tournament';
import { looseVs, testTeamSlot } from '../../../test/matchSlotFixtures';

const resolveSpy = vi.hoisted(() => vi.fn());

vi.mock('../../../core/match/tiebreakDecision', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../core/match/tiebreakDecision')>();
  return {
    ...actual,
    resolveTiebreakMode: (
      ...args: Parameters<typeof actual.resolveTiebreakMode>
    ): ReturnType<typeof actual.resolveTiebreakMode> => {
      resolveSpy(...args);
      return actual.resolveTiebreakMode(...args);
    },
  };
});

vi.mock('../../../hooks/useRepository', () => ({
  useRepository: () => ({
    get: vi.fn(() => Promise.resolve(null)),
    getAll: vi.fn(() => Promise.resolve([])),
    save: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve()),
  }),
}));

type WizardApi = ReturnType<typeof useTournamentWizard>;
const draftSpy = vi.fn<(t: Tournament) => void>();

function Harness() {
  const api: WizardApi = useTournamentWizard();
  return (
    <>
      <FinalsConfiguration formData={api.formData} onUpdate={api.updateForm} />
      <button
        type="button"
        data-testid="probe-create-draft"
        onClick={() => {
          draftSpy(api.createDraftTournament());
        }}
      >
        Entwurf erzeugen
      </button>
    </>
  );
}

function speichereTurnier(): Tournament {
  draftSpy.mockClear();
  render(<Harness />);
  fireEvent.click(screen.getByTestId('finals-preset-top-4'));
  fireEvent.click(screen.getByTestId('tiebreaker-goldenGoal'));
  fireEvent.change(screen.getByTestId('tiebreaker-round-semifinal'), {
    target: { value: 'shootout' },
  });
  fireEvent.click(screen.getByTestId('probe-create-draft'));
  const gespeichert = draftSpy.mock.calls[0]?.[0];
  if (!gespeichert) {
    throw new Error('Entwurf wurde nicht erzeugt');
  }
  return gespeichert;
}

const teams: Team[] = [
  { id: 'teamA', name: 'Alpha' },
  { id: 'teamB', name: 'Beta' },
];

function planMatch(phase: string): Match {
  return {
    id: `m-${phase}`,
    matchNumber: 1,
    round: 1,
    label: phase,
    phase,
    field: 1,
    ...looseVs('teamA', 'teamB'),
  };
}

function scheduledMatch(phase: string): ScheduledMatch {
  return {
    id: `m-${phase}`,
    matchNumber: 1,
    field: 1,
    label: phase,
    phase,
    homeTeam: 'Alpha',
    awayTeam: 'Beta',
    originalTeamA: 'teamA',
    originalTeamB: 'teamB',
    slotA: testTeamSlot('teamA'),
    slotB: testTeamSlot('teamB'),
    startTime: new Date('2026-10-05T10:00:00.000Z'),
  } as unknown as ScheduledMatch;
}

async function cockpitRegel(tournament: Tournament, phase: string): Promise<TiebreakerMode | undefined> {
  const liveMatchRepo = {
    get: vi.fn(() => Promise.resolve(null)),
    save: vi.fn((_tournamentId: string, match: unknown) => Promise.resolve(match)),
  };
  const tournamentRepo = {
    // Merge Spur A/B: initializeMatch liest die Seiten seit A-03 nur ueber die Team-ID aus dem Slot und
    // verlangt das Team im Turnier (kein Fake-Team mehr); der Wizard-Entwurf hat diese Teams nicht.
    get: vi.fn(() => Promise.resolve({
      ...tournament,
      teams: [...(tournament.teams ?? []), { id: 'teamA', name: 'Alpha' }, { id: 'teamB', name: 'Beta' }],
    })),
  };
  const service = new MatchExecutionService(
    liveMatchRepo as unknown as ILiveMatchRepository,
    tournamentRepo as unknown as ITournamentRepository,
  );
  const live = await service.initializeMatch('t1', scheduledMatch(phase));
  return live.tiebreakerMode;
}

function monitorRegel(tournament: Tournament, phase: string): TiebreakerMode | undefined {
  return toLiveMatch(planMatch(phase), teams, tournament).tiebreakerMode;
}

describe('B-04c @W2A-009 – Es gibt genau eine Entscheidungsregel', () => {
  it('Cockpit und Monitor ermitteln für dieselbe Turnier-Einstellung dieselbe Regel je Runde', async () => {
    const turnier = speichereTurnier();

    expect(turnier.finalsConfig?.tiebreaker).toBe('goldenGoal');
    expect(turnier.finalsConfig?.tiebreakerByRound?.semifinal).toBe('shootout');

    for (const round of ['semifinal', 'final'] as const satisfies readonly KnockoutRound[]) {
      const cockpit = await cockpitRegel(turnier, round);
      const monitor = monitorRegel(turnier, round);
      expect(monitor, `Runde ${round}`).toBe(cockpit);
    }

    expect(await cockpitRegel(turnier, 'semifinal')).toBe('shootout');
    expect(monitorRegel(turnier, 'semifinal')).toBe('shootout');
    expect(await cockpitRegel(turnier, 'final')).toBe('goldenGoal');
    expect(monitorRegel(turnier, 'final')).toBe('goldenGoal');
  });

  it('beide Konsumenten rufen dieselbe exportierte Funktion (Spy auf das Modul)', async () => {
    const turnier = speichereTurnier();

    resolveSpy.mockClear();
    await cockpitRegel(turnier, 'final');
    expect(resolveSpy).toHaveBeenCalledTimes(1);

    resolveSpy.mockClear();
    monitorRegel(turnier, 'final');
    expect(resolveSpy).toHaveBeenCalledTimes(1);
  });

  it('Gegenbeispiel: Gruppenspiel → keine Entscheidung bei Cockpit und Monitor', async () => {
    const turnier = speichereTurnier();

    expect(await cockpitRegel(turnier, 'groupStage')).toBeUndefined();
    expect(monitorRegel(turnier, 'groupStage')).toBeUndefined();
  });
});
