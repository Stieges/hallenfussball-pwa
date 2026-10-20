/**
 * C-ANSTOSS-OHNE-DATUM (@SL-118): `matches.scheduled_start` ist nur eine Uhrzeit (`time`). Der Anstoß eines Spiels
 * ist Turnierdatum + Anstoßzeit; der Mapper baute früher `1970-01-01T<Zeit>`.
 * Zeiten ohne Zeitzone gebaut (Wanduhr des Geräts, wie im ganzen Plan: Erzeuger, `kickoffLocal`, Rückschreiben).
 */
import { describe, it, expect } from 'vitest';
import { mapMatchFromSupabase, mapMatchToSupabase, mapTournamentFromSupabase } from '../supabaseMappers';
import { createMatchRow, createTeamRow, createTournamentRow } from '../../../../tests/factories/supabase';
import { testUuid } from '../../../test/testIds';

const [NORD, SUED] = [testUuid(1), testUuid(2)];
const row = (scheduled_start: string | null) => createMatchRow({ team_a_id: NORD, team_b_id: SUED, scheduled_start });

describe('Anstoß = Turnierdatum + Anstoßzeit', () => {
  it('@SL-118 der Anstoß liegt am Turniertag, nicht am 1.1.1970', () => {
    const kickoff = mapMatchFromSupabase(row('15:15:00'), '2026-11-28').scheduledTime;

    expect(kickoff).toEqual(new Date('2026-11-28T15:15:00'));
    expect(kickoff!.getFullYear()).toBe(2026);
  });

  it('@SL-118 das Turnierdatum der Cloud-Zeile gilt für jedes Spiel des Turniers', () => {
    const tournament = mapTournamentFromSupabase(
      createTournamentRow({ date: '2026-12-05' }),
      [createTeamRow({ id: NORD }), createTeamRow({ id: SUED })],
      [row('09:00:00'), createMatchRow({ id: 'm-2', team_a_id: SUED, team_b_id: NORD, scheduled_start: '17:40:00' })],
    );

    expect(tournament.matches.map((m) => m.scheduledTime)).toEqual([new Date('2026-12-05T09:00:00'), new Date('2026-12-05T17:40:00')]);
  });

  it('Gegenbeispiel: ein Spiel ohne Anstoßzeit hat weiter keinen Anstoß', () => {
    expect(mapMatchFromSupabase(row(null), '2026-11-28').scheduledTime).toBeUndefined();
  });

  it('Rückrichtung: Rückschreiben liefert wieder dieselbe Uhrzeit (kein Verschieben durch das Datum)', () => {
    const match = mapMatchFromSupabase(row('15:15:00'), '2026-11-28');

    expect(mapMatchToSupabase(match, 'tournament-1').scheduled_start).toBe('15:15:00');
  });
});
