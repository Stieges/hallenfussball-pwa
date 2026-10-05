/**
 * B-04 Paket b — @W1-004: Standardwerte sind gültige Spielregeln.
 *
 * Gegeben ein Turnier wurde im Schnellstart ohne Änderung der Regeln angelegt
 * Wenn am Turniertag ein Spiel gestartet wird
 * Dann nimmt der Server die Regeln (Dauer, Abschnitte, Halbzeitpause,
 * Entscheidung im Finale) ohne Fehler an
 *
 * Echter Bedienweg: useTournamentWizard (Schnellstart-Entwurf ohne Regeländerung,
 * nur useRepository gemockt) → Regeln für Gruppen- UND Finalspiel wie am Anpfiff
 * ableiten → isPayloadValid (MATCH_START).
 * UI-Ort: src/hooks/useTournamentWizard.ts (Schnellstart-Entwurf) +
 * src/core/match/payloadValidation.ts (Regel-Prüfung beim Anpfiff).
 *
 * Gegenbeispiel: Regeln mit negativer Halbzeitpause oder 0 Abschnitten → ungültig.
 * Mutation: Default `periods: 1` in src/config/sports/football.ts → `periods: 0` → rot.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTournamentWizard } from '../../../hooks/useTournamentWizard';
import { isPayloadValid } from '../../../core/match/payloadValidation';
import type { EngineEvent, MatchContext } from '../../../core/match/types';
import type { Tournament } from '../../../types/tournament';

vi.mock('../../../hooks/useRepository', () => ({
  useRepository: () => ({
    get: vi.fn(() => Promise.resolve(null)),
    getAll: vi.fn(() => Promise.resolve([])),
    save: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve()),
  }),
}));

const ctx: MatchContext = { matchId: 'm1', teamAId: 'teamA', teamBId: 'teamB' };

type AnpfiffRules = {
  sections: number;
  sectionSeconds: number;
  breakSeconds: number;
  knockout: boolean;
  tiebreak: string | null;
  overtimeSeconds: number;
  shootersPerTeam: number;
  suddenDeathAfter: number;
  penaltySeconds: number;
};

/**
 * Regeln für den MATCH_START beim Anpfiff — dieselbe Abbildung wie
 * `match_engine.server_rules` (supabase/migrations/20260928_003_append_match_events.sql,
 * dort dokumentiert unter "R4/R4b: Regeln, die der Server beim MATCH_START setzt").
 * Ohne Server-Clamps: Der Client schreibt offline dieselben Werte in den Payload,
 * die Prüfung gegen MatchRulesSchema erfolgt anschließend über isPayloadValid.
 */
function matchRulesForAnpfiff(tournament: Tournament, phase: 'groupStage' | 'final'): AnpfiffRules {
  const sections = tournament.gamePeriods ?? 1;
  const totalMinutes = phase === 'groupStage'
    ? tournament.groupPhaseGameDuration
    : tournament.finalRoundGameDuration ?? tournament.groupPhaseGameDuration;
  const settings = tournament.matchCockpitSettings;
  return {
    sections,
    sectionSeconds: Math.floor((totalMinutes * 60) / sections),
    breakSeconds: (tournament.halftimeBreak ?? 1) * 60,
    knockout: phase !== 'groupStage',
    tiebreak: tournament.finalsConfig?.tiebreaker ?? 'shootout',
    overtimeSeconds: (tournament.finalsConfig?.tiebreakerDuration ?? 5) * 60,
    shootersPerTeam: settings?.penaltyShootersPerTeam ?? 5,
    suddenDeathAfter: settings?.penaltySuddenDeathAfter ?? 6,
    penaltySeconds: 120,
  };
}

const startEvent = (rules: AnpfiffRules): EngineEvent => ({
  id: 'evt-1',
  type: 'MATCH_START',
  actor: 'helper',
  at: 1000,
  section: 1,
  clockMs: null,
  payload: { rules },
});

const schnellstartTournament = (): Tournament => {
  const { result } = renderHook(() => useTournamentWizard());
  return result.current.createDraftTournament();
};

describe('B-04b @W1-004 – Standardwerte sind gültige Spielregeln', () => {
  it('Schnellstart-Regeln für ein Gruppenspiel bestehen die Regel-Prüfung beim Anpfiff', () => {
    const tournament = schnellstartTournament();
    const rules = matchRulesForAnpfiff(tournament, 'groupStage');

    expect(rules.sections).toBe(tournament.gamePeriods);
    expect(rules.breakSeconds).toBe((tournament.halftimeBreak ?? 0) * 60);
    expect(rules.knockout).toBe(false);
    expect(isPayloadValid(startEvent(rules), ctx)).toBe(true);
  });

  it('Schnellstart-Regeln für ein Finalspiel (Entscheidung im Finale) bestehen die Regel-Prüfung', () => {
    const tournament = schnellstartTournament();
    const rules = matchRulesForAnpfiff(tournament, 'final');

    expect(rules.knockout).toBe(true);
    expect(rules.tiebreak).toBe(tournament.finalsConfig?.tiebreaker);
    expect(isPayloadValid(startEvent(rules), ctx)).toBe(true);
  });

  it('Gegenbeispiel: negative Halbzeitpause oder 0 Abschnitte sind ungültig', () => {
    const tournament = schnellstartTournament();
    const groupRules = matchRulesForAnpfiff(tournament, 'groupStage');

    const negativeBreak: AnpfiffRules = { ...groupRules, breakSeconds: -60 };
    expect(isPayloadValid(startEvent(negativeBreak), ctx)).toBe(false);

    const zeroSections: AnpfiffRules = { ...groupRules, sections: 0 };
    expect(isPayloadValid(startEvent(zeroSections), ctx)).toBe(false);
  });
});
