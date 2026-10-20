/**
 * @SL-118 mit Daten aus dem Cloud-Mapper (C-ANSTOSS-OHNE-DATUM): Der Anstoß eines Cloud-Spiels besteht aus
 * Turnierdatum + Anstoßzeit (`scheduled_start` ist nur eine Uhrzeit). Früher baute der Mapper `1970-01-01T<Zeit>`,
 * das Cockpit zeigte vor dem Anpfiff „seit 29873248 Minuten überfällig“. Geprüft wird die ganze Kette
 * Datenbankzeile → Mapper → Engine-Spielmodell → Tafel (nicht nur ISO-Strings wie im Tafel-Test).
 * Zeiten ohne Zeitzone gebaut, damit der Test unabhängig von der Gerätezeit gilt.
 */
import { describe, it, expect } from 'vitest';
import { toScoreboardModel, type ScoreboardInput } from '../toScoreboardModel';
import { cockpitPhaseOf } from '../cockpitPhase';
import { makeLiveMatch } from '../../__tests__/cockpitFixtures';
import { mapTournamentFromSupabase } from '../../../../core/repositories/supabaseMappers';
import { buildValidMatches } from '../../../../hooks/engineMatchModel';
import { createMatchRow, createTeamRow, createTournamentRow } from '../../../../../tests/factories/supabase';
import { testUuid } from '../../../../test/testIds';

const t = (key: string, o?: Record<string, unknown>) => (o ? `${key}:${JSON.stringify(o)}` : key);
const [WEST, MITTE] = [testUuid(1), testUuid(2)];
const um = (hhmm: string, tag = '2026-11-28') => new Date(`${tag}T${hhmm}:00`).getTime();

/** Spiel 13 TSV West – SG Mitte, 15:15, Feld 1, im Turnier vom 28.11.2026 – genau wie die Cloud es liefert. */
function kickoffAusCloud(date = '2026-11-28', startZeit = '15:15:00'): string {
  const tournament = mapTournamentFromSupabase(
    createTournamentRow({ date }),
    [createTeamRow({ id: WEST, name: 'TSV West' }), createTeamRow({ id: MITTE, name: 'SG Mitte' })],
    [createMatchRow({ id: testUuid(13), match_number: 13, team_a_id: WEST, team_b_id: MITTE, scheduled_start: startZeit })],
  );
  return buildValidMatches(tournament)[0].meta.scheduledKickoff;
}

function tafelHinweise(scheduledKickoff: string, jetztMs: number): string[] {
  const match = makeLiveMatch({
    id: 'm13', number: 13, status: 'NOT_STARTED', homeScore: 0, awayScore: 0, scheduledKickoff,
    homeTeam: { id: WEST, name: 'TSV West' }, awayTeam: { id: MITTE, name: 'SG Mitte' },
  });
  const input: ScoreboardInput = {
    match, phase: cockpitPhaseOf({ view: null, matchStatus: 'NOT_STARTED', leer: null }), view: null,
    links: 'home', rechts: 'away', uhrArt: 'durchlaufend-letzte-minute-angehalten', eintraegeWarten: 0, helferAnfragen: 0,
    jetztMs, fieldName: 'Feld 1', tournamentName: 'Hallencup Süd',
    vor: { anstoss: '15:15', mindestpause: null, sperrHinweise: [], leer: null, uebernahmeVon: null },
  };
  return toScoreboardModel(input, t).hinweise;
}

describe('@SL-118 Cloud-Spiel: überfällig wird aus Turnierdatum + Anstoßzeit gerechnet', () => {
  it('vor dem Anpfiff (15:14) und genau zur Anstoßzeit (15:15) ist ein Cloud-Spiel nicht überfällig', () => {
    for (const jetzt of [um('15:14'), um('15:15')]) {
      expect(tafelHinweise(kickoffAusCloud(), jetzt).some((h) => h.startsWith('tafel.vor.ueberfaellig'))).toBe(false);
    }
  });

  it('Gegenbeispiel: um 15:22 ist dasselbe Cloud-Spiel seit 7 Minuten überfällig', () => {
    expect(tafelHinweise(kickoffAusCloud(), um('15:22'))).toContain('tafel.vor.ueberfaellig:{"minuten":7}');
  });

  it('Gegenbeispiel: am Tag danach zählt das Datum mit (24 Stunden + 7 Minuten = 1447 Minuten)', () => {
    expect(tafelHinweise(kickoffAusCloud(), um('15:22', '2026-11-29'))).toContain('tafel.vor.ueberfaellig:{"minuten":1447}');
  });
});
