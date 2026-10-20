/**
 * Spielnummer zwischen Gerät und Cloud (Befunde C-SPIELNUMMER-FEHLT, C-FINALRUNDE-REIHENFOLGE).
 *
 * Aus den Szenarien: @SL-049 (Cockpit zeigt „Spiel 13 … 15:15, Feld 1“ – Spielnummern gelten wörtlich),
 * @ZM-007 (Zuschauer sehen „Spiel 1 als beendet mit 2:0“ – Spiel 1 ist das erste Spiel des Plans),
 * @TM-142 (Halbfinale 1 und Halbfinale 2 sind zwei Spiele). Turnier „Hallencup Nord“ über den echten Weg
 * (Veröffentlichen + Mapper-Rundlauf): 12 Gruppenspiele, dann Halbfinale 1 und 2, Finale, Spiel um Platz 3.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { Match, Tournament } from '../../../types/tournament';
import {
  mapMatchToSupabase,
  mapTeamToSupabase,
  mapTournamentFromSupabase,
  mapTournamentToSupabase,
} from '../supabaseMappers';
import { createMatchRow, createTeamRow, createTournamentRow, type MatchRow } from '../../../../tests/factories/supabase';
import { publishHallencup, GAME } from '../../view/__fixtures__/hallencupNord';
import { copyTeamsAndMatches } from '../../models/tournamentCopy';

const EINS_BIS_16 = Array.from({ length: 16 }, (_, i) => i + 1);

let cup: Tournament;
beforeAll(async () => {
  cup = (await publishHallencup()).tournament;
});

/** Cloud-Zeilen, wie sie die Datenbank heute liefert: `match_number` NULL, Reihenfolge vertauscht. */
function cloudRowsOhneNummer(): MatchRow[] {
  return cup.matches.map((m) => createMatchRow({ ...mapMatchToSupabase(m, cup.id), match_number: null })).reverse();
}

function liesAusCloud(rows: MatchRow[]): Tournament {
  return mapTournamentFromSupabase(
    createTournamentRow({ id: cup.id, date: cup.date }),
    cup.teams.map((t) => createTeamRow(mapTeamToSupabase(t, cup.id))),
    rows,
  );
}

const ohneNummer = (matches: readonly Match[]): Match[] => matches.map(({ matchNumber: _weg, ...rest }) => rest);

describe('Spielnummer: Veröffentlichen und Speichern schreiben sie', () => {
  it('@SL-049 C-SPIELNUMMER-FEHLT: Veröffentlichen gibt jedem Spiel seine Nummer in Spielplan-Reihenfolge, der Mapper-Rundlauf behält sie', () => {
    expect(cup.matches.map((m) => m.matchNumber)).toEqual(EINS_BIS_16);
    expect(mapTournamentToSupabase(cup, 'owner-1').matchRows.map((r) => r.match_number)).toEqual(EINS_BIS_16);
  });

  it('@SL-049 C-SPIELNUMMER-FEHLT: ein lokal ohne Nummer gespeichertes Turnier schreibt beim Speichern die Nummern in die Cloud (nie NULL)', () => {
    const rows = mapTournamentToSupabase({ ...cup, matches: ohneNummer(cup.matches) }, 'owner-1').matchRows;

    expect(rows.map((r) => r.match_number)).toEqual(EINS_BIS_16);
  });
});

describe('Spielnummer: Lesen aus der Cloud', () => {
  it('@ZM-007 C-SPIELNUMMER-FEHLT: Zeilen ohne Nummer in vertauschter Reihenfolge → Spiel 1 ist das erste Spiel des Plans, gelesen in der Reihenfolge 1, 2, 3 …', () => {
    const gelesen = liesAusCloud(cloudRowsOhneNummer());

    expect(gelesen.matches.map((m) => m.id)).toEqual(cup.matches.map((m) => m.id));
    expect(gelesen.matches.map((m) => m.matchNumber)).toEqual(EINS_BIS_16);
  });

  it('@TM-142 C-FINALRUNDE-REIHENFOLGE: ohne gespeicherte Nummer heißen Halbfinale 1 und 2 verschieden, Halbfinale 1 zuerst', () => {
    const gelesen = liesAusCloud(cloudRowsOhneNummer());
    const hf1 = gelesen.matches.find((m) => m.id === cup.matches[GAME.HF1].id);
    const hf2 = gelesen.matches.find((m) => m.id === cup.matches[GAME.HF2].id);

    expect(hf1?.label).toBe('1. Halbfinale');
    expect(hf2?.label).toBe('2. Halbfinale');
    expect(hf1?.matchNumber).toBe(13);
    expect(hf2?.matchNumber).toBe(14);
  });

  it('Gegenbeispiel: gespeicherte Nummern gelten, auch wenn ein Spiel inzwischen später liegt (Nummer bleibt stabil)', () => {
    const rows = cup.matches.map((m, i) => createMatchRow({ ...mapMatchToSupabase(m, cup.id), match_number: i + 1 }));
    // Spiel 3 wurde ans Ende des Tages verschoben – es heißt weiter „Spiel 3“
    rows[2] = { ...rows[2], scheduled_start: '20:00:00' };

    const gelesen = liesAusCloud([...rows].reverse());

    expect(gelesen.matches.find((m) => m.id === cup.matches[2].id)?.matchNumber).toBe(3);
    expect(gelesen.matches.map((m) => m.matchNumber)).toEqual(EINS_BIS_16);
  });

  it('@SL-049 C-SPIELNUMMER-FEHLT: die Kopie fürs Proben trägt dieselben Spielnummern wie das gelesene Turnier', () => {
    const gelesen = liesAusCloud(cloudRowsOhneNummer());
    let n = 0;
    const kopie = copyTeamsAndMatches(gelesen, () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`);

    expect(kopie.matches.map((m) => m.matchNumber)).toEqual(EINS_BIS_16);
  });
});
