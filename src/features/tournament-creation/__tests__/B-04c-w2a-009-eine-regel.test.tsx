/**
 * B-04 Paket c — @W2A-009: Es gibt genau eine Entscheidungsregel.
 *
 * Gegeben ein K.-o.-Spiel endet unentschieden
 * Wenn Spielsteuerung, Monitor und Server die Entscheidung bestimmen
 * Dann verwenden alle dieselbe eingestellte Regel
 *
 * Echter Bedienweg: Oberfläche (FinalsConfiguration) → gespeichertes Turnier →
 *   - Spielsteuerung/Cockpit (Engine-Weg, startEngineSpiel): die Startregel der echten MatchEngine
 *   - Monitor: toLiveMatch (src/features/monitor-display/monitorMatch.ts)
 * Die SQL-Seite (match_engine.server_rules) prüft `scripts/append-match-events-check.sh` am gemeinsamen
 * Vertrags-Fixture `src/core/match/__contracts__/server-rules-ko-entscheidung.json`.
 *
 * UI-Ort: src/features/tournament-creation/components/FinalsConfiguration.tsx (Einstellung).
 *
 * Mutation: eine zweite, abweichende Ermittlung in einem Konsumenten → rot.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useTournamentWizard } from '../../../hooks/useTournamentWizard';
import { FinalsConfiguration } from '../components/FinalsConfiguration';
import { toLiveMatch } from '../../../features/monitor-display/monitorMatch';
import { buildMonitorView } from '../../../features/monitor-display/monitorView';
import { startEngineSpiel } from '../../../test/engineSpielFixture';
import type { Match, Team, Tournament, TiebreakerMode, KnockoutRound } from '../../../types/tournament';
import { looseVs } from '../../../test/matchSlotFixtures';

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

/** Cockpit-Seite auf dem Engine-Weg (A-08d1): Regel des Engine-Stands für die Phase. */
async function cockpitRegel(tournament: Tournament, phase: string): Promise<TiebreakerMode | undefined> {
  const spiel = await startEngineSpiel(tournament, { phase });
  return spiel.tiebreakerMode;
}

function monitorRegel(tournament: Tournament, phase: string): TiebreakerMode | undefined {
  const match = planMatch(phase);
  const shown = buildMonitorView({ ...tournament, teams, matches: [match] }).byId.get(match.id);
  if (!shown) {
    throw new Error('Spiel fehlt in der Ansicht');
  }
  return toLiveMatch(shown, match, teams, tournament).tiebreakerMode;
}

describe('B-04c @W2A-009 – Es gibt genau eine Entscheidungsregel', () => {
  it('(Wizard) @W2A-009: die Einstellung je Runde wird im Entwurf gespeichert', () => {
    const turnier = speichereTurnier();

    expect(turnier.finalsConfig?.tiebreaker).toBe('goldenGoal');
    expect(turnier.finalsConfig?.tiebreakerByRound?.semifinal).toBe('shootout');
  });

  it('(Monitor) @W2A-009: der Monitor zeigt je Runde die eingestellte Regel', () => {
    const turnier = speichereTurnier();

    expect(monitorRegel(turnier, 'semifinal')).toBe('shootout');
    expect(monitorRegel(turnier, 'final')).toBe('goldenGoal');
  });

  // erwartet rot bis B-10b1/A-27 – Befund C-KO-RUNDENREGEL-SERVER bzw. ZA-1 (task-GB5-plan.md); Markierung entfernen, sobald grün
  // Engine-Weg: serverRules liest nur finalsConfig.tiebreaker (global), nicht tiebreakerByRound → Halbfinale goldenGoal statt shootout.
  // Nach A-27 muss der Vergleich je Runde grün werden; der Halbfinal-Wert (shootout ≠ Finale goldenGoal) bleibt als Gegenbeispiel nötig.
  it.fails('@W2A-009 Cockpit (Engine-Weg) zeigt je Runde dieselbe Regel wie der Monitor', async () => {
    const turnier = speichereTurnier();

    for (const round of ['semifinal', 'final'] as const satisfies readonly KnockoutRound[]) {
      const cockpit = await cockpitRegel(turnier, round);
      const monitor = monitorRegel(turnier, round);
      expect(cockpit, `Runde ${round}`).toBe(monitor);
    }
  });

  it('@W2A-009 Cockpit und Monitor zeigen für das Finale dieselbe Regel (goldenGoal)', async () => {
    const turnier = speichereTurnier();

    expect(await cockpitRegel(turnier, 'final')).toBe('goldenGoal');
    expect(monitorRegel(turnier, 'final')).toBe('goldenGoal');
  });

  it('Gegenbeispiel @W2A-009: Gruppenspiel → keine Entscheidung bei Cockpit und Monitor', async () => {
    const turnier = speichereTurnier();

    expect(await cockpitRegel(turnier, 'groupStage')).toBeUndefined();
    expect(monitorRegel(turnier, 'groupStage')).toBeUndefined();
  });
});
