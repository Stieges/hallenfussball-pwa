/**
 * Fixture für die PDF-Charakterisierung (B-28a0, Spur C).
 *
 * „Hallencup Nord“ laut Record turnier-bekannt-machen (Gemeinsames Beispielturnier): D-Junioren, zwei Gruppen
 * à vier Teams, Halbfinale 1/2, Spiel um Platz 3, Finale. Die Spielliste entsteht über den **echten**
 * `generateFullSchedule` (nur aufrufen, nichts verändern). Reine Testdaten.
 */
import type { Team, Tournament } from '../../../types/tournament';
import { createMockTournament } from '../../../test/factories';
import { generateFullSchedule } from '../../../core/generators';
import type { GeneratedSchedule, ScheduledMatch } from '../../../core/generators';

export const HALLENCUP_TEAMS: Team[] = [
  { id: 'team-nord', name: 'FC Nord', group: 'A' },
  { id: 'team-sued', name: 'SV Süd', group: 'A' },
  { id: 'team-berg', name: 'DJK Berg', group: 'A' },
  { id: 'team-tal', name: 'TuS Tal', group: 'A' },
  { id: 'team-west', name: 'TSV West', group: 'B' },
  { id: 'team-ost', name: 'SC Ost', group: 'B' },
  { id: 'team-mitte', name: 'FC Mitte', group: 'B' },
  { id: 'team-hof', name: 'SV Hof', group: 'B' },
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
      tiebreakerByRound: { final: 'overtime-then-shootout', placement: 'shootout' },
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
 * Setzt den Spielstand eines Spiels (Nummer, 1-basiert) am Plan – so wie `PDFExportDialog` ihn vor dem
 * Export aus `tournament.matches` einmischt. Status (läuft, ausgefallen, korrigiert) steht heute nicht am
 * ScheduledMatch; das ist Arbeit von a3 (`withTournamentState`).
 */
export function withMatchScore(
  schedule: GeneratedSchedule,
  matchNumber: number,
  score: { scoreA: number; scoreB: number },
): GeneratedSchedule {
  const apply = (m: ScheduledMatch): ScheduledMatch =>
    m.matchNumber === matchNumber ? { ...m, ...score } : m;
  return {
    ...schedule,
    allMatches: schedule.allMatches.map(apply),
    phases: schedule.phases.map(p => ({ ...p, matches: p.matches.map(apply) })),
  };
}

/** Eine Spielnummer aus dem Plan (wirft, wenn sie fehlt – damit ein Test nie leer grün ist). */
export function matchByNumber(schedule: GeneratedSchedule, matchNumber: number): ScheduledMatch {
  const found = schedule.allMatches.find(m => m.matchNumber === matchNumber);
  if (!found) {
    throw new Error(`Spiel ${matchNumber} fehlt im Fixture-Plan`);
  }
  return found;
}

/**
 * Ein Builder für Spielseiten. Heute zeigt der Export `homeTeam`/`awayTeam` (Generator-Text).
 * B-35 stellt nur diese Funktion auf `slotLabel` um; Tests erwarten Seiten immer über sie.
 */
export function sideName(match: ScheduledMatch, side: 'A' | 'B'): string {
  return side === 'A' ? match.homeTeam : match.awayTeam;
}

/** Spiele der Gruppenphase (Phase `groupStage`). */
export function groupMatches(schedule: GeneratedSchedule): ScheduledMatch[] {
  return schedule.allMatches.filter(m => m.phase === 'groupStage');
}

/** Spiele der Finalrunde (alle Phasen außer `groupStage`). */
export function finalsMatches(schedule: GeneratedSchedule): ScheduledMatch[] {
  return schedule.allMatches.filter(m => m.phase !== 'groupStage');
}
