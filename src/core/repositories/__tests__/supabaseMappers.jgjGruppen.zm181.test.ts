/**
 * @ZM-181 @ZM-177 @ZM-170 Mapper-Rundreise für gespeicherte Gruppen (Review PR #419, 🟡1): „Jeder gegen jeden“ hat keine Gruppen – Lesen
 * und Schreiben lassen die früher gespeicherten Standardgruppen A/B weg; bei Gruppen + Finalrunde bleibt die Konfiguration samt
 * `customName` unverändert; der Wechsel des Systems folgt dem jeweils aktuellen `groupSystem`. Der sichtbare Leser
 * (`GroupStageSchedule`: Gruppen-Spalte nur bei mehr als einer Gruppe) bekommt dadurch bei Bestands-Turnieren keine Spalte mehr.
 */
import { describe, expect, it } from 'vitest';
import { mapTournamentFromSupabase, mapTournamentToSupabase } from '../supabaseMappers';
import { createTournamentRow, type TournamentRow } from '../../../../tests/factories/supabase';
import type { Tournament } from '../../../types/tournament';

const GRUPPEN = [{ id: 'A', customName: 'Löwen' }, { id: 'B' }];

function lesen(groupSystem: string, groups: unknown): Tournament {
  return mapTournamentFromSupabase(createTournamentRow({ config: { groupSystem, groups } as unknown as TournamentRow['config'] }), [], []);
}
function schreiben(t: Tournament): Record<string, unknown> {
  const { tournamentRow } = mapTournamentToSupabase(t, 'user-1');
  return (JSON.parse(JSON.stringify(tournamentRow)) as { config: Record<string, unknown> }).config;
}
/** Bedingung des Lesers `GroupStageSchedule.tsx` (`showGroupLabel`). */
const zeigtGruppenSpalte = (t: Tournament): boolean => (t.groups?.length ?? 0) > 1;

describe('@ZM-181 Mapper: Gruppen bei Jeder gegen jeden', () => {
  it('Lesen: Jeder gegen jeden mit gespeicherten Gruppen A/B -> keine Gruppen, keine Gruppen-Spalte im Spielplan', () => {
    const t = lesen('roundRobin', GRUPPEN);
    expect(t.groups).toBeUndefined();
    expect(zeigtGruppenSpalte(t)).toBe(false);
  });

  it('Schreiben: ein Turnier Jeder gegen jeden mit Gruppen A/B schreibt kein `config.groups`', () => {
    const t = { ...lesen('groupsAndFinals', GRUPPEN), groupSystem: 'roundRobin' as const };
    expect(schreiben(t).groups).toBeUndefined();
  });

  it('Gegenbeispiel: Gruppen + Finalrunde behält die Gruppen mit customName, lesend und schreibend, und zeigt die Gruppen-Spalte', () => {
    const t = lesen('groupsAndFinals', GRUPPEN);
    expect(t.groups).toEqual(GRUPPEN);
    expect(zeigtGruppenSpalte(t)).toBe(true);
    expect(schreiben(t).groups).toEqual(GRUPPEN);
  });

  it('Wechsel des Systems: dieselben gespeicherten Gruppen gelten bei Gruppen + Finalrunde, bei Jeder gegen jeden nicht', () => {
    expect(lesen('groupsAndFinals', GRUPPEN).groups).toHaveLength(2);
    expect(lesen('roundRobin', GRUPPEN).groups).toBeUndefined();
    expect(schreiben({ ...lesen('groupsAndFinals', GRUPPEN), groupSystem: 'roundRobin' }).groups).toBeUndefined();
    expect(schreiben(lesen('groupsAndFinals', GRUPPEN)).groups).toHaveLength(2);
  });
});
