/**
 * Spielauswahl im Cockpit der Turnierleitung (Befund C-SPIELNUMMER-FEHLT, Durchstich Nikolaus: „#3 … #15, #1, #2“).
 *
 * @SL-049 (Record Spiel leiten, „Spielnummern gelten wörtlich“): nach Spiel 11 steht auf Feld 1 Spiel 13 bereit –
 * die Spiele eines Felds folgen in ihrer Spielplan-Reihenfolge mit ihrer Nummer. Geprüft über den echten Lesepfad:
 * Veröffentlichen → Cloud-Zeilen ohne `match_number` (vertauscht) → `mapTournamentFromSupabase` → `generateFullSchedule`
 * → Spiele des Felds, wie die Auswahl sie listet („#<Nr> - <Heim> vs <Gast>“).
 */
import { describe, it, expect } from 'vitest';
import type { ITournamentRepository } from '../../../core/repositories/ITournamentRepository';
import { TournamentCreationService } from '../../../core/services/TournamentCreationService';
import { mapMatchToSupabase, mapTeamToSupabase, mapTournamentFromSupabase } from '../../../core/repositories/supabaseMappers';
import { generateFullSchedule } from '../../../core/generators';
import { createMatchRow, createTeamRow, createTournamentRow } from '../../../../tests/factories/supabase';
import { publishHallencup } from '../../../core/view/__fixtures__/hallencupNord';
import type { Team, Tournament } from '../../../types/tournament';
import { matchesOfFieldInPlayOrder } from '../utils/fieldMatchOrder';

const uuid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const TEAMS: Team[] = ['TSV Waging rot', 'TSV Waging blau', 'DJK Otting', 'TSV 1921 Fridolfing', 'SV Kirchanschöring', 'TSV Petting']
  .map((name, i) => ({ id: uuid(i + 1), name }));

const repository = { save: () => Promise.resolve() } as unknown as ITournamentRepository;

/** Ein Feld, eine Gruppe, sechs Mannschaften – 15 Spiele wie das Nikolaus-Turnier. */
function publishEinFeld(): Promise<Tournament> {
  return new TournamentCreationService(repository).publish({
    title: 'Nikolaus-Turnier',
    date: '2026-11-28',
    timeSlot: '16:30 - 19:00',
    numberOfFields: 1,
    numberOfTeams: 6,
    numberOfGroups: 1,
    groupSystem: 'roundRobin',
    groupPhaseGameDuration: 9,
    groupPhaseBreakDuration: 1,
    teams: TEAMS,
    shareCode: 'NIKO28',
  });
}

/** Wie die Cloud das Turnier heute liefert: Spiele ohne Nummer, Zeilen vertauscht. */
function ausDerCloud(t: Tournament): Tournament {
  const rows = t.matches.map((m) => createMatchRow({ ...mapMatchToSupabase(m, t.id), match_number: null }));
  const gelesen = mapTournamentFromSupabase(
    createTournamentRow({ id: t.id, date: t.date }),
    t.teams.map((team) => createTeamRow(mapTeamToSupabase(team, t.id))),
    [...rows.slice(2), ...rows.slice(0, 2)],
  );
  return { ...t, matches: gelesen.matches };
}

describe('@SL-049 Spielauswahl im Cockpit: Spiele eines Felds mit ihrer Nummer, in Spielplan-Reihenfolge', () => {
  it('@SL-049 C-SPIELNUMMER-FEHLT: ein Feld, 15 Spiele – die Auswahl zählt #1, #2, #3 … #15, Spiel 1 ist das erste Spiel des Plans', async () => {
    const original = await publishEinFeld();
    const schedule = generateFullSchedule(ausDerCloud(original));

    const auswahl = matchesOfFieldInPlayOrder(schedule.allMatches, 1);

    expect(auswahl.map((m) => m.matchNumber)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
    expect(auswahl[0].id).toBe(original.matches[0].id);
    expect(auswahl.map((m) => m.id)).toEqual(original.matches.map((m) => m.id));
  });

  it('@SL-049 C-SPIELNUMMER-FEHLT Gegenbeispiel: zwei Felder – Feld 2 listet nur seine Spiele, aufsteigend und ohne Lücke zum Plan', async () => {
    const original = (await publishHallencup()).tournament;
    const schedule = generateFullSchedule(ausDerCloud(original));

    const feld2 = matchesOfFieldInPlayOrder(schedule.allMatches, 2);
    const erwartet = original.matches.filter((m) => m.field === 2).map((m) => m.matchNumber);

    expect(erwartet.length).toBeGreaterThan(0);
    expect(erwartet.every((n) => typeof n === 'number')).toBe(true);
    expect(feld2.every((m) => m.field === 2)).toBe(true);
    expect(feld2.map((m) => m.matchNumber)).toEqual(erwartet);
    expect([...erwartet].sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual(erwartet);
  });
});

describe('matchesOfFieldInPlayOrder', () => {
  it('@SL-049 Gegenbeispiel: die Reihenfolge der übergebenen Liste ändert die Auswahl nicht (Platz im Raster, dann Nummer)', () => {
    const spiel = (id: string, field: number, slot: number, matchNumber: number) => ({ id, field, slot, matchNumber });
    const liste = [spiel('c', 1, 2, 5), spiel('x', 2, 0, 2), spiel('a', 1, 0, 1), spiel('b', 1, 1, 3)];

    expect(matchesOfFieldInPlayOrder(liste, 1).map((m) => m.id)).toEqual(['a', 'b', 'c']);
    expect(matchesOfFieldInPlayOrder([...liste].reverse(), 1).map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });
});
