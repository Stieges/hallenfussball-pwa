/**
 * Übersetzt einen Handzettel-Fall (`handzettelFaelle.ts`) in Turnier und Plan, wie die App sie dem PDF gibt: gespeicherte
 * Spiele mit Spielnummer, Uhrzeit und Seiten als Slot (Team-ID bzw. offene Herkunft), gelesen über den echten
 * `generateFullSchedule` (Lesepfad „vorhandene Spiele“). Reine Testdaten.
 */
import { generateFullSchedule, type GeneratedSchedule } from '../../../../core/generators';
import { TeamIdSchema, type MatchSlot, type SlotSource } from '../../../../core/models/schemas/MatchSlotSchema';
import { createMockTournament } from '../../../../test/factories';
import { testUuid } from '../../../../test/testIds';
import { DEFAULT_MATCH_COCKPIT_SETTINGS, type Match, type PlacementCriterion, type Team, type Tournament } from '../../../../types/tournament';
import { FALL_SHARE_CODE, type FallHerkunft, type FallSpiel, type FallZustand, type HandzettelFall } from './handzettelFaelle';

/** Nummernkreis je Fall: Teams ab Basis + 1, Spiele ab Basis × 10 + Spielnummer. */
const BASIS: Record<HandzettelFall['name'], number> = { a: 200, b: 400, c: 300, 'b-lang': 500 };

/** Team-ID eines Teams im Fall (wirft bei unbekanntem Namen, damit ein Tippfehler nie still durchgeht). */
export function fallTeamId(fall: HandzettelFall, name: string): string {
  const index = fall.teams.findIndex(team => team.name === name);
  if (index < 0) {
    throw new Error(`Team „${name}“ fehlt im Fall ${fall.name}`);
  }
  return testUuid(BASIS[fall.name] + index + 1);
}

/** Spiel-ID einer Spielnummer im Fall. */
export function fallMatchId(fall: HandzettelFall, nr: number): string {
  return testUuid(BASIS[fall.name] * 10 + nr);
}

const KRITERIEN: Record<string, PlacementCriterion> = {
  points: { id: 'points', enabled: true },
  goalDifference: { id: 'goalDifference', enabled: true },
  goalsFor: { id: 'goalsFor', enabled: true },
  directComparison: { id: 'directComparison', enabled: true },
};

/** Ortszeit des Turniertags, `zeit` als "HH:MM". */
function anpfiff(fall: HandzettelFall, zeit: string): Date {
  const [jahr = 0, monat = 1, tag = 1] = fall.datum.split('-').map(Number);
  const [stunde = 0, minute = 0] = zeit.split(':').map(Number);
  return new Date(jahr, monat - 1, tag, stunde, minute);
}

function zustandFelder(zustand: FallZustand | undefined): Partial<Match> {
  if (!zustand) {
    return { matchStatus: 'scheduled' };
  }
  if (zustand.status === 'running' || zustand.status === 'paused') {
    // Zwischenstand im Modell: erscheint im Ausdruck nie (@DR-019)
    return { matchStatus: zustand.status, ...(zustand.a === undefined ? {} : { scoreA: zustand.a, scoreB: zustand.b ?? 0 }) };
  }
  if (zustand.status !== 'finished') {
    return { matchStatus: zustand.status };
  }
  return {
    matchStatus: 'finished',
    scoreA: zustand.a,
    scoreB: zustand.b,
    ...(zustand.overtime ? { overtimeScoreA: zustand.overtime[0], overtimeScoreB: zustand.overtime[1] } : {}),
    ...(zustand.penalty ? { penaltyScoreA: zustand.penalty[0], penaltyScoreB: zustand.penalty[1], decidedBy: 'penalty' as const } : {}),
  };
}

function teamSlot(fall: HandzettelFall, name: string): MatchSlot {
  return { kind: 'team', teamId: TeamIdSchema.parse(fallTeamId(fall, name)) };
}

function herkunft(fall: HandzettelFall, h: FallHerkunft): SlotSource {
  if ('rang' in h) {
    return { kind: 'groupRank', group: h.gruppe, rank: h.rang };
  }
  return 'sieger' in h
    ? { kind: 'matchResult', matchId: fallMatchId(fall, h.sieger), role: 'winner' }
    : { kind: 'matchResult', matchId: fallMatchId(fall, h.verlierer), role: 'loser' };
}

function gruppenSpiel(fall: HandzettelFall, s: FallSpiel): Match {
  return {
    id: fallMatchId(fall, s.nr), round: s.nr, field: 1, slot: s.nr - 1, matchNumber: s.nr,
    slotA: teamSlot(fall, s.heim), slotB: teamSlot(fall, s.gast),
    ...(s.gruppe ? { group: s.gruppe } : {}),
    isFinal: false, phase: 'groupStage', scheduledTime: anpfiff(fall, s.zeit),
    ...(s.sr === undefined ? {} : { referee: s.sr }),
    ...zustandFelder(s.zustand),
  };
}

/** Gespeicherte Spiele des Falls (Gruppenphase, dann Finalrunde). */
export function fallMatches(fall: HandzettelFall): Match[] {
  const finale = (fall.finale ?? []).map((f): Match => {
    const quelleA = herkunft(fall, f.heim);
    const quelleB = herkunft(fall, f.gast);
    const finalType = f.runde === 'thirdPlace' || f.runde === 'final' ? { finalType: f.runde } : {};
    return {
      id: fallMatchId(fall, f.nr), round: f.nr, field: 1, slot: f.nr - 1, matchNumber: f.nr,
      slotA: { kind: 'pending', source: quelleA }, slotB: { kind: 'pending', source: quelleB }, originA: quelleA, originB: quelleB,
      isFinal: true, phase: f.runde === 'thirdPlace' ? 'final' : f.runde, ...finalType, scheduledTime: anpfiff(fall, f.zeit),
      ...zustandFelder(f.zustand),
    };
  });
  return [...fall.spiele.map(s => gruppenSpiel(fall, s)), ...finale];
}

/** Turnier des Falls: öffentlich geteilt (`K7M2QX`), ein Feld, Wertung wie im Mockup. */
export function fallTournament(fall: HandzettelFall, overrides: Partial<Tournament> = {}): Tournament {
  const teams: Team[] = fall.teams.map(team => ({ id: fallTeamId(fall, team.name), name: team.name, ...(team.gruppe ? { group: team.gruppe } : {}) }));
  const mitFinale = (fall.finale ?? []).length > 0;
  const wertung = mitFinale ? ['points', 'directComparison', 'goalDifference', 'goalsFor'] : ['points', 'goalDifference', 'goalsFor', 'directComparison'];
  return createMockTournament({
    id: `fall-${fall.name}`,
    ...(fall.regelwerk === undefined ? {} : { rulebook: fall.regelwerk }),
    ...(fall.zeitstrafeSek === undefined ? {} : { matchCockpitSettings: { ...DEFAULT_MATCH_COCKPIT_SETTINGS, timePenaltyDurationSeconds: fall.zeitstrafeSek } }),
    title: fall.titel,
    ageClass: fall.altersklasse,
    organizer: fall.veranstalter,
    date: fall.datum,
    timeSlot: fall.beginn,
    location: { name: fall.halle, ...(fall.adresse ?? {}) },
    groupSystem: mitFinale ? 'groupsAndFinals' : 'roundRobin',
    numberOfGroups: mitFinale ? 2 : 1,
    numberOfFields: 1,
    numberOfTeams: teams.length,
    groupPhaseGameDuration: fall.spielMin,
    groupPhaseBreakDuration: fall.pauseMin,
    finalRoundGameDuration: fall.spielMin,
    finalRoundBreakDuration: fall.pauseMin,
    placementLogic: wertung.map(id => KRITERIEN[id]).filter((k): k is PlacementCriterion => k !== undefined),
    placementsToPlayOut: mitFinale ? [] : [1],
    teams,
    matches: fallMatches(fall),
    finalsConfig: mitFinale ? { preset: 'top-8', placements: [3], tiebreakerByRound: { ...fall.entscheidung } } : { preset: 'none' },
    finals: { final: mitFinale, thirdPlace: mitFinale, fifthSixth: false, seventhEighth: false },
    ...(fall.schiedsrichterNamen
      ? { refereeConfig: { mode: 'organizer' as const, numberOfReferees: fall.schiedsrichterNamen.length, refereeNames: Object.fromEntries(fall.schiedsrichterNamen.map((n, i) => [i + 1, n])) } }
      : {}),
    isPublic: true,
    shareCode: FALL_SHARE_CODE,
    ...overrides,
  });
}

/** Plan des Falls über den Lesepfad (vorhandene Spiele), wie Export und Zuschauer-Seite ihn bauen. */
export function fallSchedule(fall: HandzettelFall, locale: 'de' | 'en' = 'de', overrides: Partial<Tournament> = {}): GeneratedSchedule {
  return generateFullSchedule(fallTournament(fall, overrides), locale);
}
