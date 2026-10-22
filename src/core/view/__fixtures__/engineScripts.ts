/**
 * Ereignis-Abläufe für die Fixture „Hallencup Nord“ (A-36b): Live-Zustände entstehen über die Engine
 * (`reduceMatch` → `cacheColumns`), nie als von Hand gesetztes `matchStatus`.
 */
import type { EngineEvent, MatchRules } from '../../match/types';

export const GROUP_RULES: MatchRules = {
  sections: 2,
  sectionSeconds: 600,
  breakSeconds: 60,
  knockout: false,
  tiebreak: null,
  overtimeSeconds: 0,
  shootersPerTeam: 5,
  suddenDeathAfter: 5,
  penaltySeconds: 120,
};

const KO_RULES: MatchRules = {
  ...GROUP_RULES,
  sections: 1,
  knockout: true,
  tiebreak: 'overtime-then-shootout',
  overtimeSeconds: 300,
};

/** Baut Ereignisse mit fortlaufender ID (UUID-Form) für ein Spiel. */
function script(prefix: number): (partial: Partial<EngineEvent> & Pick<EngineEvent, 'type' | 'at'>) => EngineEvent {
  let n = 0;
  return (partial) => {
    n += 1;
    const id = `${String(prefix).padStart(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;
    return { id, actor: 'helper', section: 1, clockMs: null, payload: {}, ...partial };
  };
}

/** Ergebnis nur eingetragen, ohne Verlauf (@ZM-147). */
export function resultEntry(prefix: number, teamA: string, teamB: string, a: number, b: number): EngineEvent[] {
  const ev = script(prefix);
  return [ev({ type: 'RESULT_ENTRY', actor: 'leitung', at: 1000, section: null, payload: { scores: { [teamA]: a, [teamB]: b } } })];
}

/** Anpfiff, ein Tor für Heim, dann Uhr angehalten (Cache `paused`), @ZM-040. */
export function pausedAtOneNil(prefix: number, teamA: string): EngineEvent[] {
  const ev = script(prefix);
  return [
    ev({ type: 'MATCH_START', at: 1000, payload: { rules: GROUP_RULES } }),
    ev({ type: 'GOAL', at: 200000, clockMs: 199000, teamId: teamA }),
    ev({ type: 'PAUSE', at: 460000, clockMs: 459000 }),
  ];
}

/**
 * Spiel beenden (@FU-112, @FU-114): Anpfiff, Tor für Heim zum 1:0, Spielzeit (2 × 10 min) abgelaufen ohne Abpfiff
 * (`ohneEnde`), danach beendet die Turnierleitung im Spielplan mit `a:b` (RESULT_ENTRY mit `basedOn` = das Tor).
 */
export function endedInSchedule(prefix: number, teamA: string, teamB: string, a: number, b: number, ohneEnde = false): EngineEvent[] {
  const ev = script(prefix);
  const start = ev({ type: 'MATCH_START', at: 1000, payload: { rules: GROUP_RULES } });
  const goal = ev({ type: 'GOAL', at: 200000, clockMs: 199000, teamId: teamA });
  if (ohneEnde) {
    return [start, goal];
  }
  return [start, goal, ev({ type: 'RESULT_ENTRY', actor: 'leitung', at: 1_300_000, section: null, payload: { scores: { [teamA]: a, [teamB]: b }, basedOn: goal.id } })];
}

/** Nur angepfiffen (0:0, läuft). */
export function kickedOff(prefix: number): EngineEvent[] {
  const ev = script(prefix);
  return [ev({ type: 'MATCH_START', at: 1000, payload: { rules: GROUP_RULES } })];
}

/** Von der Leitung abgesetzt („ausgefallen“, @ZM-104). */
export function skipped(prefix: number): EngineEvent[] {
  const ev = script(prefix);
  return [ev({ type: 'SKIP', actor: 'leitung', at: 1000, section: null, payload: { reason: 'Team fehlt' } })];
}

/** 1:1 nach regulärer Zeit, Verlängerung 3:0 → 4:1 n. V. (F-NV). */
export function overtimeFourOne(prefix: number, teamA: string, teamB: string): EngineEvent[] {
  const ev = script(prefix);
  return [
    ev({ type: 'MATCH_START', at: 1000, payload: { rules: KO_RULES } }),
    ev({ type: 'GOAL', at: 100000, clockMs: 99000, teamId: teamA }),
    ev({ type: 'GOAL', at: 200000, clockMs: 199000, teamId: teamB }),
    ev({ type: 'MATCH_END', at: 601000, clockMs: 600000 }),
    ev({ type: 'SECTION_START', at: 661000, section: 2, clockMs: 600000 }),
    ev({ type: 'GOAL', at: 700000, section: 2, clockMs: 639000, teamId: teamA }),
    ev({ type: 'GOAL', at: 760000, section: 2, clockMs: 699000, teamId: teamA }),
    ev({ type: 'GOAL', at: 820000, section: 2, clockMs: 759000, teamId: teamA }),
    ev({ type: 'MATCH_END', at: 901000, section: 2, clockMs: 900000 }),
  ];
}

/** 1:1 nach Verlängerung, Strafstoßschießen 4:3 für Heim (F-ES). */
export function shootoutFourThree(prefix: number, teamA: string, teamB: string): EngineEvent[] {
  const ev = script(prefix);
  const kicks: Array<[string, boolean]> = [
    [teamA, true], [teamB, true], [teamA, true], [teamB, true], [teamA, true],
    [teamB, true], [teamA, true], [teamB, false], [teamA, false], [teamB, false],
  ];
  return [
    ev({ type: 'MATCH_START', at: 1000, payload: { rules: KO_RULES } }),
    ev({ type: 'GOAL', at: 100000, clockMs: 99000, teamId: teamA }),
    ev({ type: 'GOAL', at: 200000, clockMs: 199000, teamId: teamB }),
    ev({ type: 'MATCH_END', at: 601000, clockMs: 600000 }),
    ev({ type: 'SECTION_START', at: 661000, section: 2, clockMs: 600000 }),
    ev({ type: 'MATCH_END', at: 961000, section: 2, clockMs: 900000 }),
    ...kicks.map(([teamId, scored], index) =>
      ev({ type: 'SHOOTOUT_KICK', at: 970000 + index * 10000, section: 2, teamId, payload: { scored } }),
    ),
    ev({ type: 'SHOOTOUT_END', at: 1080000, section: 2 }),
  ];
}
