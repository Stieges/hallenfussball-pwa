/**
 * Fixture für die Monitor-Charakterisierung (B-16a, Spur B).
 *
 * Ein Turnier „Hallencup Nord“ mit Gruppe A/B, zwei Feldern und drei Spielen, die die
 * Folien-Tests brauchen. Reine Testdaten: keine Produktivlogik, keine Zeitabhängigkeit
 * außer dem festen Anpfiff von Spiel 9.
 */
import type { Match, Team, Tournament, TournamentField } from '../../../types/tournament';
import type { MonitorSlide, PerformanceMode, SlideConfig, SlideType, TournamentMonitor } from '../../../types/monitor';
import type { Sponsor } from '../../../types/sponsor';
import { createMockTournament } from '../../../test/factories';
import { looseVs } from '../../../test/matchSlotFixtures';

const TIMESTAMP = '2026-10-10T09:00:00.000Z';

export const FIXTURE_TEAMS: Team[] = [
  { id: 'team-nord', name: 'FC Nord', group: 'A' },
  { id: 'team-sued', name: 'SV Süd', group: 'A' },
  { id: 'team-ost', name: 'SC Ost', group: 'A' },
  { id: 'team-berg', name: 'DJK Berg', group: 'B' },
  { id: 'team-mitte', name: 'TuS Mitte', group: 'B' },
  { id: 'team-west', name: 'Kickers West', group: 'B' },
];

export const FIXTURE_FIELDS: TournamentField[] = [
  { id: 'field-1', defaultName: 'Feld 1' },
  { id: 'field-2', defaultName: 'Feld 2' },
];

/** Spiel 1: Feld 2, FC Nord 2:1 SC Ost (beendet, Gruppe A). */
/** Spiel 7: Feld 1, FC Nord – SV Süd (läuft, 1:0). */
/** Spiel 8: Feld 2, DJK Berg – TuS Mitte (geplant). */
/** Spiel 9: Feld 1, TuS Mitte – Kickers West (geplant, 14:40). */
export const FIXTURE_MATCHES: Match[] = [
  { id: 'match-1', matchNumber: 1, round: 1, field: 2, group: 'A', ...looseVs('team-nord', 'team-ost'), scoreA: 2, scoreB: 1, matchStatus: 'finished' },
  { id: 'match-7', matchNumber: 7, round: 3, field: 1, group: 'A', ...looseVs('team-nord', 'team-sued'), scoreA: 1, scoreB: 0, matchStatus: 'running' },
  { id: 'match-8', matchNumber: 8, round: 4, field: 2, group: 'B', ...looseVs('team-berg', 'team-mitte'), matchStatus: 'scheduled', scheduledTime: new Date('2026-10-10T14:20:00') },
  { id: 'match-9', matchNumber: 9, round: 5, field: 1, group: 'B', ...looseVs('team-mitte', 'team-west'), matchStatus: 'scheduled', scheduledTime: new Date('2026-10-10T14:40:00') },
];

/** Gibt die Spielliste zurück, in der genau das Spiel `id` mit `patch` überschrieben ist. */
export function withMatch(id: string, patch: Partial<Match>): Match[] {
  return FIXTURE_MATCHES.map(m => (m.id === id ? { ...m, ...patch } : m));
}

/** Turnier-Flags als Teilobjekt für `buildTournament`. */
export function withFlags(flags: Partial<Pick<Tournament, 'hideScoresForPublic' | 'isPublic' | 'shareCode'>>): Partial<Tournament> {
  return flags;
}

/** Turnier „Hallencup Nord“: öffentlich, Share-Code ABC123, Überschreibungen über `overrides`. */
export function buildTournament(overrides: Partial<Tournament> = {}): Tournament {
  return createMockTournament({
    id: 'tour-1',
    title: 'Hallencup Nord',
    teams: FIXTURE_TEAMS,
    matches: FIXTURE_MATCHES,
    fields: FIXTURE_FIELDS,
    numberOfFields: 2,
    isPublic: true,
    shareCode: 'ABC123',
    hideScoresForPublic: false,
    ...overrides,
  });
}

/** Sponsor „Bäckerei Maier“ (Folien-Referenz `sponsorId: 'sp-1'`). */
export const FIXTURE_SPONSOR: Sponsor = {
  id: 'sp-1',
  name: 'Bäckerei Maier',
  tier: 'gold',
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
};

let slideCounter = 0;

/** Eine Monitor-Folie. `duration` null = Monitor-Default. */
export function slide(type: SlideType, config: SlideConfig = {}, duration: number | null = null): MonitorSlide {
  slideCounter += 1;
  return { id: `slide-${slideCounter}`, type, config, duration, order: slideCounter - 1 };
}

/** Ein Monitor mit Profil `high`, Übergang aus (harte Schnitte), Overrides über `overrides`. */
export function withMonitor(overrides: Partial<TournamentMonitor> & { performanceMode?: PerformanceMode } = {}): TournamentMonitor {
  return {
    id: 'mon-1',
    name: 'Haupthalle',
    defaultSlideDuration: 15,
    transition: 'none',
    transitionDuration: 0,
    theme: 'dark',
    performanceMode: 'high',
    slides: [],
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  };
}

/** Hängt den Monitor an das Turnier, so wie die Seite es aus der Quelle lädt. */
export function attachMonitor(tournament: Tournament, monitor: TournamentMonitor): Tournament {
  return { ...tournament, monitors: [monitor] };
}
