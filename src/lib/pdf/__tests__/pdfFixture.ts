/**
 * Fixture für die PDF-Charakterisierung (B-28a0, Spur C).
 *
 * „Hallencup Nord“ laut Record turnier-bekannt-machen (Gemeinsames Beispielturnier): D-Junioren, zwei Gruppen
 * à vier Teams, Halbfinale 1/2, Spiel um Platz 3, Finale. Die Spielliste entsteht über den **echten**
 * `generateFullSchedule` (nur aufrufen, nichts verändern). Reine Testdaten.
 */
import type { Match, MatchStatus, Standing, Team, Tournament } from '../../../types/tournament';
import { createMockTournament } from '../../../test/factories';
import { generateFullSchedule } from '../../../core/generators';
import type { GeneratedSchedule, ScheduledMatch } from '../../../core/generators';
import { sideLabel } from '../matchSides';
import { buildPdfTexts } from '../translations';
import { translatorFor } from './pdfText';
import { testUuid } from '../../../test/testIds';

/** Team-IDs des Hallencups (UUIDs, A-01: Spielseiten tragen nur Team-IDs). */
export const HALLENCUP_ID = {
  nord: testUuid(101),
  sued: testUuid(102),
  berg: testUuid(103),
  tal: testUuid(104),
  west: testUuid(105),
  ost: testUuid(106),
  mitte: testUuid(107),
  hof: testUuid(108),
} as const;

export const HALLENCUP_TEAMS: Team[] = [
  { id: HALLENCUP_ID.nord, name: 'FC Nord', group: 'A' },
  { id: HALLENCUP_ID.sued, name: 'SV Süd', group: 'A' },
  { id: HALLENCUP_ID.berg, name: 'DJK Berg', group: 'A' },
  { id: HALLENCUP_ID.tal, name: 'TuS Tal', group: 'A' },
  { id: HALLENCUP_ID.west, name: 'TSV West', group: 'B' },
  { id: HALLENCUP_ID.ost, name: 'SC Ost', group: 'B' },
  { id: HALLENCUP_ID.mitte, name: 'FC Mitte', group: 'B' },
  { id: HALLENCUP_ID.hof, name: 'SV Hof', group: 'B' },
];

/** Turnier „Hallencup Nord“: öffentlich, Share-Code ABC123, Überschreibungen über `overrides`. */
export function hallencupTournament(overrides: Partial<Tournament> = {}): Tournament {
  return createMockTournament({
    id: 'tour-hallencup-nord',
    title: 'Hallencup Nord',
    ageClass: 'D-Junioren',
    organizer: 'SV Nord 1921 e. V.',
    date: '2026-11-14',
    timeSlot: '13:00',
    location: { name: 'Sporthalle am Park' },
    groupSystem: 'groupsAndFinals',
    numberOfGroups: 2,
    numberOfFields: 2,
    numberOfTeams: HALLENCUP_TEAMS.length,
    groupPhaseGameDuration: 10,
    groupPhaseBreakDuration: 0,
    teams: HALLENCUP_TEAMS,
    matches: [],
    finalsConfig: {
      preset: 'top-4',
      // ZA-3 (E1): Halbfinale ausdrücklich eingestellt – ohne Eintrag gälte der Rückfall „Verlängerung, dann
      // Strafstoßschießen“ (@SL-145); das Muster prüft das Layout, nicht den Rückfall.
      tiebreakerByRound: { semifinal: 'shootout', final: 'overtime-then-shootout', placement: 'shootout' },
    },
    finals: { final: true, thirdPlace: true, fifthSixth: false, seventhEighth: false },
    isPublic: true,
    shareCode: 'ABC123',
    ...overrides,
  });
}

/** Spielplan des Hallencups über den echten Generator (ohne gespeicherte Spiele). */
export function hallencupSchedule(tournament: Tournament = hallencupTournament()): GeneratedSchedule {
  return generateFullSchedule(tournament, 'de');
}

/**
 * Setzt Spielstand und Status eines Spiels (Nummer, 1-basiert) am Plan und spiegelt beides in
 * `tournament.matches` der Fixture, so wie `PDFExportDialog` es vor dem Export aus dem Turnier einmischt.
 * Standard ist `finished` (Ergebnis gilt als beendet). Laufende Spiele (@BM-012) werden ausdrücklich mit
 * `'running'` gesetzt. Korrektur-Status und Historie kommen mit a3-4 (`withTournamentState`).
 */
/** Plan mit gespiegelten Turnier-Spielen (Ergebnis und Status), wie sie der Dialog einmischt. */
export type FixtureSchedule = GeneratedSchedule & { fixtureMatches: Match[] };

export function withMatchResult(
  schedule: GeneratedSchedule,
  matchNumber: number,
  score: { scoreA: number; scoreB: number },
  matchStatus: MatchStatus = 'finished',
): FixtureSchedule {
  const base = schedule.allMatches.find(m => m.matchNumber === matchNumber);
  if (!base) {
    throw new Error(`Spiel ${matchNumber} fehlt im Fixture-Plan`);
  }
  const apply = (m: ScheduledMatch): ScheduledMatch =>
    m.matchNumber === matchNumber ? { ...m, ...score } : m;
  const mirror: Match = {
    id: base.id,
    round: 0,
    field: base.field,
    slotA: base.slotA,
    slotB: base.slotB,
    originA: base.originA,
    originB: base.originB,
    group: base.group,
    phase: base.phase,
    matchNumber,
    ...score,
    matchStatus,
  };
  return {
    ...schedule,
    allMatches: schedule.allMatches.map(apply),
    phases: schedule.phases.map(p => ({ ...p, matches: p.matches.map(apply) })),
    fixtureMatches: [...fixtureMatchesOf(schedule).filter(m => m.matchNumber !== matchNumber), mirror],
  };
}

function fixtureMatchesOf(schedule: GeneratedSchedule): Match[] {
  return (schedule as Partial<FixtureSchedule>).fixtureMatches ?? [];
}

/**
 * Wächter für Fixtures: Spielnummern, die ein Ergebnis tragen, aber nicht `finished` sind. Leer heißt ok.
 */
export function unfinishedWithResult(schedule: GeneratedSchedule): number[] {
  return fixtureMatchesOf(schedule)
    .filter(m => m.matchNumber !== undefined && m.scoreA !== undefined && m.matchStatus !== 'finished')
    .map(m => m.matchNumber!);
}

/**
 * Echte Tabellen-Werte je Gruppe (direkt gebaut, nicht über `calculations.ts` – B-40). Gleichstand nach Punkten
 * in Gruppe A (Berg und Nord, 6 Pkt.): die Tordifferenz entscheidet. Alle Zahlen sind konsistent (Sp = S+U+N).
 */
export const HALLENCUP_STANDINGS: Standing[] = (() => {
  const team = (id: string): Team => {
    const found = HALLENCUP_TEAMS.find(t => t.id === id);
    if (!found) {throw new Error(`Team ${id} fehlt in HALLENCUP_TEAMS`);}
    return found;
  };
  const row = (id: string, won: number, drawn: number, lost: number, goalsFor: number, goalsAgainst: number): Standing => ({
    team: team(id),
    played: won + drawn + lost,
    won,
    drawn,
    lost,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    points: won * 3 + drawn,
  });
  return [
    row(HALLENCUP_ID.berg, 2, 0, 1, 5, 2),  // Gruppe A, 6 Pkt., +3
    row(HALLENCUP_ID.nord, 2, 0, 1, 4, 3),  // Gruppe A, 6 Pkt., +1
    row(HALLENCUP_ID.sued, 1, 1, 1, 3, 4),  // Gruppe A, 4 Pkt., -1
    row(HALLENCUP_ID.tal, 0, 0, 3, 1, 4),   // Gruppe A, 0 Pkt., -3
    row(HALLENCUP_ID.west, 3, 0, 0, 7, 1),  // Gruppe B, 9 Pkt., +6
    row(HALLENCUP_ID.ost, 1, 1, 1, 3, 3),   // Gruppe B, 4 Pkt., 0
    row(HALLENCUP_ID.mitte, 1, 0, 2, 3, 5), // Gruppe B, 3 Pkt., -2
    row(HALLENCUP_ID.hof, 0, 1, 2, 2, 6),   // Gruppe B, 1 Pkt., -4
  ];
})();

/** Eine Spielnummer aus dem Plan (wirft, wenn sie fehlt – damit ein Test nie leer grün ist). */
export function matchByNumber(schedule: GeneratedSchedule, matchNumber: number): ScheduledMatch {
  const found = schedule.allMatches.find(m => m.matchNumber === matchNumber);
  if (!found) {
    throw new Error(`Spiel ${matchNumber} fehlt im Fixture-Plan`);
  }
  return found;
}

/**
 * Ein Builder für Spielseiten: wie der Export (`sideLabel`, deutsch), also Teamname oder Herkunft im Klartext
 * (B-28 C4). `matches` benennt das Vorgängerspiel einer Sieger-/Verlierer-Herkunft (Finalspiele: `schedule.allMatches` des Plans übergeben).
 */
export function sideName(match: ScheduledMatch, side: 'A' | 'B', matches: readonly ScheduledMatch[] = []): string {
  return sideLabel(match, side, { t: buildPdfTexts(translatorFor('de'), 'de'), isTeam: name => HALLENCUP_TEAMS.some(team => team.name === name), matches });
}

/** Spiele der Gruppenphase (Phase `groupStage`). */
export function groupMatches(schedule: GeneratedSchedule): ScheduledMatch[] {
  return schedule.allMatches.filter(m => m.phase === 'groupStage');
}

/** Spiele der Finalrunde (alle Phasen außer `groupStage`). */
export function finalsMatches(schedule: GeneratedSchedule): ScheduledMatch[] {
  return schedule.allMatches.filter(m => m.phase !== 'groupStage');
}
