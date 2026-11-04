/**
 * Testturnier für die Listen-Folien (@ZM-187, @ZM-188): Jeder gegen jeden mit 6 Teams, 15 Spiele auf Feld 1 im Abstand von 12 Minuten
 * (wie das Nikolaus-Turnier aus @ZM-185). Die Spiele 1 bis 5 sind beendet; wahlweise Spiel 6 gewertet 3:0 und alle Spiele ab Spiel 7
 * um 10 Minuten nach hinten verschoben (die ursprüngliche Uhrzeit bleibt als `originalStart`). Nur Testumgebung und Prüfstand.
 */
import type { Match, Team, Tournament } from '../../../types/tournament';
import { testUuid, vs } from '../../../test/matchSlotFixtures';
import { buildTournament, FIXTURE_FIELDS } from './monitorFixture';

export const KURZE_NAMEN = ['Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921', 'TSV Waging rot', 'TSV Petting', 'DJK Otting', 'TSV 1921 Fridolfing', 'TSV Waging blau'] as const;
/** 45 bis 50 Zeichen, kein Wort aus der Kürzungsliste, kein Kurzname (@ZM-150). */
export const LANGE_NAMEN = [
  'Mannschaftsgemeinschaft Oberweiler Unterweiler Nord',
  'Freizeitfußballer Großkarolinenfeld Süd Ost Vereinigte',
  'Spielgemeinschaft Hammerau Piding Anger Nordwest',
  'Hallenfreunde Bergheim Teisendorf Land Mannschaft 1928',
  'Jugendspielgemeinschaft Chiemgau Ost Mannschaft Zwei',
  'Traunsteiner Hallenkicker Haslach Vereinigte 2010 Team',
] as const;

export interface ListenTurnierOptions {
  namen?: 'kurz' | 'lang';
  /** Spiel 6 gewertet 3:0 (Nichtantritt) */
  gewertet?: boolean;
  /** Spiele ab Spiel 7 um 10 Minuten nach hinten verschoben, „(war hh:mm)“ */
  verschoben?: boolean;
  /** Anzahl beendeter Spiele von Spiel 1 an (Vorgabe 5) */
  beendet?: number;
}

const START = new Date(2026, 10, 28, 9, 0);
const AM = (n: number): Date => new Date(START.getTime() + (n - 1) * 12 * 60_000);

function paarungen(): Array<[number, number]> {
  const alle: Array<[number, number]> = [];
  for (let a = 1; a <= 6; a += 1) { for (let b = a + 1; b <= 6; b += 1) { alle.push([a, b]); } }
  // Reihenfolge so mischen, dass dasselbe Team selten zweimal hintereinander spielt
  return alle.filter((_, i) => i % 2 === 0).concat(alle.filter((_, i) => i % 2 === 1));
}

export function listenTurnier(opts: ListenTurnierOptions = {}): Tournament {
  const { namen = 'kurz', gewertet = false, verschoben = false, beendet = 5 } = opts;
  const liste = namen === 'lang' ? LANGE_NAMEN : KURZE_NAMEN;
  const teams: Team[] = liste.map((name, i) => ({ id: testUuid(i + 1), name }));
  const matches: Match[] = paarungen().map(([a, b], i): Match => {
    const nr = i + 1;
    const basis: Match = {
      id: `liste-${String(nr).padStart(2, '0')}`, matchNumber: nr, round: nr, field: 1, ...vs(testUuid(a), testUuid(b)),
      matchStatus: 'scheduled', scheduledTime: AM(nr),
    };
    if (nr <= beendet) {
      return { ...basis, matchStatus: 'finished', scoreA: (nr % 3) + 1, scoreB: nr % 2, decidedBy: 'regular' };
    }
    if (gewertet && nr === 6) {
      return { ...basis, matchStatus: 'finished', scoreA: 3, scoreB: 0, decidedBy: 'forfeit', forfeitAbsent: 'B' };
    }
    if (verschoben && nr >= 7) {
      return { ...basis, scheduledTime: new Date(AM(nr).getTime() + 10 * 60_000), originalStart: AM(nr) };
    }
    return basis;
  });
  return buildTournament({
    id: 'tour-liste', title: 'Nikolaus-Turnier', teams, matches, fields: FIXTURE_FIELDS.slice(0, 1), numberOfFields: 1,
    groupSystem: 'roundRobin', date: '2026-11-28',
  });
}
