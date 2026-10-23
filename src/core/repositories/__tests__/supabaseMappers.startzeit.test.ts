/**
 * C-STARTTIME, @FU-128: Ein Turnier ohne Startzeit lässt sich speichern und kommt ohne Startzeit zurück.
 * Szenario: docs/anforderungen/plattform/2026-09-24_fundament-gemeinsamer-stand.md.
 * Die Spalte `start_time` ist vom Typ time: eine leere Zeichenkette lehnt Postgres ab, NULL nimmt sie an.
 * Der Weg läuft über eine echte JSON-Grenze (was der Supabase-Client sendet).
 */
import { describe, it, expect } from 'vitest';
import { mapTournamentFromSupabase, mapTournamentToSupabase } from '../supabaseMappers';
import { createTournamentRow, type TournamentRow } from '../../../../tests/factories/supabase';

function ueberDieLeitung(row: TournamentRow) {
  const tournament = mapTournamentFromSupabase(row, [], []);
  const { tournamentRow } = mapTournamentToSupabase(tournament, 'user-1');
  return { tournament, gesendet: JSON.parse(JSON.stringify(tournamentRow)) as { start_time: string | null } };
}

describe('Startzeit beim Speichern (@FU-128, C-STARTTIME)', () => {
  it('@FU-128 ohne Startzeit geht NULL an den Server, keine leere Zeichenkette', () => {
    const { gesendet } = ueberDieLeitung(createTournamentRow({ start_time: null }));
    expect(gesendet.start_time).toBeNull();
  });

  it('@FU-128 und beim Laden steht weiterhin keine Startzeit da', () => {
    const { gesendet } = ueberDieLeitung(createTournamentRow({ start_time: null }));
    const zurueck = mapTournamentFromSupabase(createTournamentRow({ start_time: gesendet.start_time }), [], []);
    expect(zurueck.startTime).toBeUndefined();
  });

  it('@FU-128 Gegenbeispiel: trägt Olli später 09:30 ein, geht 09:30 an den Server und kommt als 09:30 zurück', () => {
    const { tournament } = ueberDieLeitung(createTournamentRow({ start_time: null }));
    const { tournamentRow } = mapTournamentToSupabase({ ...tournament, startTime: '09:30', timeSlot: '09:30' }, 'user-1');
    expect(tournamentRow.start_time).toBe('09:30');
    // der Server gibt time-Spalten als HH:MM:SS zurück
    const zurueck = mapTournamentFromSupabase(createTournamentRow({ start_time: '09:30:00' }), [], []);
    expect(zurueck.startTime).toBe('09:30');
  });

  it('@FU-128 Zeitspanne als Startzeit (z. B. aus einem JSON-Import): die erste Uhrzeit wird übernommen', () => {
    const { tournament } = ueberDieLeitung(createTournamentRow({ start_time: null }));
    const { tournamentRow } = mapTournamentToSupabase({ ...tournament, startTime: undefined, timeSlot: '09:00 - 16:00' }, 'user-1');
    expect(tournamentRow.start_time).toBe('09:00');
  });

  it('@FU-128 Text ohne Uhrzeit ergibt NULL', () => {
    const { tournament } = ueberDieLeitung(createTournamentRow({ start_time: null }));
    const { tournamentRow } = mapTournamentToSupabase({ ...tournament, startTime: undefined, timeSlot: 'ganztägig' }, 'user-1');
    expect(tournamentRow.start_time).toBeNull();
  });

  it('@FU-128 der Server liefert 09:30:00, die Anzeige zeigt 09:30', () => {
    const zurueck = mapTournamentFromSupabase(createTournamentRow({ start_time: '09:30:00' }), [], []);
    expect(zurueck.startTime).toBe('09:30');
    expect(zurueck.timeSlot).toBe('09:30');
  });
});
