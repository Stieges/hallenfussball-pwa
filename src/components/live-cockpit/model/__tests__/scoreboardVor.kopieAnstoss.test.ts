/**
 * @W5-029 (C-KOPIE-ANSTOSS-ALTES-DATUM): In der Kopie fürs Proben stehen die Anstoßzeiten am Datum der Kopie – auf jedem
 * Gerät. Aus dem Gherkin geschrieben, nicht am Code abgelesen:
 *   Spiel 1 des Hallencup Ost ist am 28.11. um 16:30 angesetzt; Olli kopiert mit dem Datum 26.11.
 *   → Spiel 1 der Kopie steht am 26.11. um 16:30, auch auf Ollis Gerät (das die Kopie gebaut hat),
 *   → am 26.11. um 16:40 ist es seit 10 Minuten überfällig, um 16:20 nicht.
 * Das kopierende Gerät hält die Kopie im Speicher (Spiele des Originals, Turnierdatum neu); jedes andere Gerät lädt sie aus
 * der Cloud (`matches.scheduled_start` ist nur eine Uhrzeit, das Datum kommt von `tournaments.date`). Beide Wege müssen
 * dasselbe Ergebnis liefern. Zeiten ohne Zeitzone gebaut (Ortszeit), das Gerät steht im Test fest auf Europe/Berlin.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { toScoreboardModel, type ScoreboardInput } from '../toScoreboardModel';
import { cockpitPhaseOf } from '../cockpitPhase';
import { makeLiveMatch } from '../../__tests__/cockpitFixtures';
import { mapTournamentFromSupabase, mapTournamentToSupabase } from '../../../../core/repositories/supabaseMappers';
import { buildCopiedTournament } from '../../../../core/models/tournamentCopy';
import { buildValidMatches } from '../../../../hooks/engineMatchModel';
import { createMatchRow, createTeamRow, createTournamentRow } from '../../../../../tests/factories/supabase';
import { testUuid } from '../../../../test/testIds';
import type { Tournament } from '../../../../types/tournament';

let vorherigeZeitzone: string | undefined;
beforeAll(() => { vorherigeZeitzone = process.env.TZ; process.env.TZ = 'Europe/Berlin'; });
afterAll(() => { if (vorherigeZeitzone === undefined) { delete process.env.TZ; } else { process.env.TZ = vorherigeZeitzone; } });

const t = (key: string, o?: Record<string, unknown>) => (o ? `${key}:${JSON.stringify(o)}` : key);
const [OST, WEST, MITTE] = [testUuid(1), testUuid(2), testUuid(3)];
const um = (hhmm: string, tag: string) => new Date(`${tag}T${hhmm}:00`).getTime();

/** Hallencup Ost, wie die Cloud ihn liefert: Turnierdatum 28.11.2026, Spiel 1 um 16:30, Spiel 2 um 16:40. */
function hallencupOst(): Tournament {
  return mapTournamentFromSupabase(
    createTournamentRow({ id: OST, title: 'Hallencup Ost', date: '2026-11-28' }),
    [createTeamRow({ id: WEST, name: 'TSV West' }), createTeamRow({ id: MITTE, name: 'SG Mitte' })],
    [
      createMatchRow({ id: testUuid(21), match_number: 1, team_a_id: WEST, team_b_id: MITTE, scheduled_start: '16:30:00' }),
      createMatchRow({ id: testUuid(22), match_number: 2, team_a_id: MITTE, team_b_id: WEST, scheduled_start: '16:40:00' }),
    ],
  );
}

/** Olli kopiert mit dem Datum 26.11. – das Turnier im Speicher seines Geräts. */
function kopieAufOllisGeraet(startDate = '2026-11-26'): Tournament {
  return buildCopiedTournament(hallencupOst(), {
    newId: testUuid(9), title: 'Hallencup Ost (Probe)', now: '2026-11-20T10:00:00.000Z', makeId: () => crypto.randomUUID(), startDate,
  });
}

/** Toms Gerät: dieselbe Kopie, gespeichert und neu aus der Cloud geladen (Zeilen wie die Datenbank sie hält). */
function kopieAufToms(kopie: Tournament): Tournament {
  const { tournamentRow, teamRows, matchRows } = mapTournamentToSupabase(kopie, 'olli');
  return mapTournamentFromSupabase(
    createTournamentRow({ id: kopie.id, date: tournamentRow.date }),
    teamRows.map((row) => createTeamRow({ id: row.id, name: row.name })),
    matchRows.map((row) => createMatchRow({
      id: row.id, match_number: row.match_number ?? null, team_a_id: row.team_a_id ?? null, team_b_id: row.team_b_id ?? null,
      scheduled_start: row.scheduled_start ?? null,
    })),
  );
}

const anstossVonSpiel1 = (tournament: Tournament): string => {
  const spiel1 = buildValidMatches(tournament).find((eintrag) => eintrag.meta.number === 1);
  if (spiel1 === undefined) { throw new Error('Spiel 1 fehlt im Engine-Modell'); }
  return spiel1.meta.scheduledKickoff;
};

function tafelHinweise(scheduledKickoff: string, jetztMs: number): string[] {
  const match = makeLiveMatch({
    id: 'm1', number: 1, status: 'NOT_STARTED', homeScore: 0, awayScore: 0, scheduledKickoff,
    homeTeam: { id: WEST, name: 'TSV West' }, awayTeam: { id: MITTE, name: 'SG Mitte' },
  });
  const input: ScoreboardInput = {
    match, phase: cockpitPhaseOf({ view: null, matchStatus: 'NOT_STARTED', leer: null }), view: null,
    links: 'home', rechts: 'away', uhrArt: 'durchlaufend-letzte-minute-angehalten', eintraegeWarten: 0, helferAnfragen: 0,
    jetztMs, fieldName: 'Feld 1', tournamentName: 'Hallencup Ost (Probe)',
    vor: { anstoss: '16:30', mindestpause: null, sperrHinweise: [], leer: null, uebernahmeVon: null },
  };
  return toScoreboardModel(input, t).hinweise;
}

describe('@W5-029 In der Kopie fürs Proben stehen die Anstoßzeiten am Datum der Kopie', () => {
  it('@W5-029 Spiel 1 der Kopie steht auf Ollis Gerät am 26.11. um 16:30', () => {
    expect(anstossVonSpiel1(kopieAufOllisGeraet())).toBe(new Date('2026-11-26T16:30:00').toISOString());
  });

  it('@W5-029 Spiel 1 der Kopie steht auf Toms Gerät (aus der Cloud geladen) am 26.11. um 16:30', () => {
    expect(anstossVonSpiel1(kopieAufToms(kopieAufOllisGeraet()))).toBe(new Date('2026-11-26T16:30:00').toISOString());
  });

  it('@W5-029 auf jedem Gerät derselbe Anstoß für jedes Spiel der Kopie', () => {
    const olli = kopieAufOllisGeraet();
    const kickoffs = (tournament: Tournament) => buildValidMatches(tournament).map((e) => e.meta.scheduledKickoff);
    expect(kickoffs(olli)).toEqual([new Date('2026-11-26T16:30:00').toISOString(), new Date('2026-11-26T16:40:00').toISOString()]);
    expect(kickoffs(kopieAufToms(olli))).toEqual(kickoffs(olli));
  });

  it('@W5-029 am 26.11. um 16:40 ist Spiel 1 der Kopie seit 10 Minuten überfällig – auf beiden Geräten', () => {
    const olli = kopieAufOllisGeraet();
    for (const tournament of [olli, kopieAufToms(olli)]) {
      expect(tafelHinweise(anstossVonSpiel1(tournament), um('16:40', '2026-11-26'))).toContain('tafel.vor.ueberfaellig:{"minuten":10}');
    }
  });

  it('@W5-029 am 26.11. um 16:20 ist Spiel 1 der Kopie nicht überfällig – auf beiden Geräten', () => {
    const olli = kopieAufOllisGeraet();
    for (const tournament of [olli, kopieAufToms(olli)]) {
      expect(tafelHinweise(anstossVonSpiel1(tournament), um('16:20', '2026-11-26')).some((h) => h.startsWith('tafel.vor.ueberfaellig'))).toBe(false);
    }
  });

  it('@W5-029 Gegenbeispiel: das Original bleibt am 28.11. um 16:30 (am 26.11. um 16:40 noch nicht überfällig)', () => {
    const original = hallencupOst();
    kopieAufOllisGeraet(); // Kopieren verändert das Original nicht
    expect(anstossVonSpiel1(original)).toBe(new Date('2026-11-28T16:30:00').toISOString());
    expect(tafelHinweise(anstossVonSpiel1(original), um('16:40', '2026-11-26')).some((h) => h.startsWith('tafel.vor.ueberfaellig'))).toBe(false);
  });

  it('@W5-029 Gegenbeispiel: ein späteres Datum der Kopie verschiebt den Anstoß nach hinten (30.11. um 16:30, am 28.11. nicht überfällig)', () => {
    const kopie = kopieAufOllisGeraet('2026-11-30');
    expect(anstossVonSpiel1(kopie)).toBe(new Date('2026-11-30T16:30:00').toISOString());
    expect(tafelHinweise(anstossVonSpiel1(kopie), um('16:40', '2026-11-28')).some((h) => h.startsWith('tafel.vor.ueberfaellig'))).toBe(false);
  });
});
