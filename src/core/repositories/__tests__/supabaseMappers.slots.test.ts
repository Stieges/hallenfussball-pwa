/**
 * A-02 (MVP-Bauplan Spur A, GA1): Cloud-Schreibweg mit Team-IDs.
 *
 * Der Mapper schreibt die Spielseite aus dem Slot (`slotA/slotB`, A-01): Team-ID nach
 * `team_x_id`, Herkunft nach `slot_x_source`. Er sucht nie über Namen – vorher landete die
 * Team-ID als Text im Platzhalter, `team_x_id` blieb NULL und `append_match_events` lehnte jedes
 * Spiel mit 22023 ab (C-TEAMREF).
 *
 * Anforderungen: @FU-001 (Einträge kommen bei anderen Geräten an – setzt voraus, dass die Cloud
 * sie annimmt), @TM-027 (alle Geräte zeigen dieselbe Besetzung – Lesen liefert genau die gespeicherte
 * Besetzung). Die Teamtausch-Tests prüfen nur, dass ein Tausch die Cloud erreicht – @FU-053 („Tor bleibt
 * bei FC Nord“) erfüllt A-02 NICHT (Zwischenspeicher score_a/score_b folgt dem Tausch nicht; Befund
 * beim Controller, Review A-02 I2).
 */
import { describe, it, expect } from 'vitest';
import {
  mapMatchFromSupabase,
  mapMatchToSupabase,
  mapMatchToScheduleUpdate,
  mapMatchUpdateToSupabase,
  mapTournamentFromSupabase,
  mapTournamentToSupabase,
} from '../supabaseMappers';
import { RepositoryError } from '../../errors';
import { teamSlot, pendingSlot } from '../../models/matchSlot';
import type { Match } from '../../models/types';
import { createMatchRow, createTeamRow, createTournamentRow } from '../../../../tests/factories/supabase';
import { testUuid } from '../../../test/testIds';
import { withStaleSides } from '../../../test/matchSlotFixtures';

const NORD = testUuid(1);
const SUED = testUuid(2);
const HF1 = testUuid(101);

/** Köder: veraltetes Feld teamA/teamB (Altdaten vor A-36a) mit TEAMNAMEN – der Mapper darf es nie lesen. */
function match(overrides: Partial<Match> = {}): Match {
  return withStaleSides({
    id: testUuid(201),
    round: 1,
    field: 1,
    slotA: teamSlot(NORD),
    slotB: teamSlot(SUED),
    ...overrides,
  }, 'FC Nord', 'SV Süd');
}

describe('A-02 mapMatchToSupabase – Spielseite aus dem Slot, nie über Namen', () => {
  it('@FU-001 Pflicht: Gruppenspiel schreibt beide Team-IDs aus dem Slot (append_match_events braucht team_a_id/team_b_id)', () => {
    const row = mapMatchToSupabase(match(), 'tournament-1');

    expect(row.team_a_id).toBe(NORD);
    expect(row.team_b_id).toBe(SUED);
    expect(row.slot_a_source).toBeNull();
    expect(row.slot_b_source).toBeNull();
    expect(row.team_a_placeholder).toBeNull();
    expect(row.team_b_placeholder).toBeNull();
  });

  it('@FU-001 Gegenbeispiel: ein Teamname im Übergangsfeld teamA ändert die geschriebene Team-ID nicht', () => {
    // Slot sagt SÜD, teamA sagt (veraltet) „FC Nord“ – ein Namens-Lookup über das Turnier würde NORD schreiben.
    const tournament = mapTournamentFromSupabase(
      createTournamentRow(),
      [createTeamRow({ id: NORD, name: 'FC Nord' }), createTeamRow({ id: SUED, name: 'SV Süd' })],
      []
    );
    tournament.matches = [match({ slotA: teamSlot(SUED), slotB: teamSlot(NORD) })];

    const { matchRows } = mapTournamentToSupabase(tournament, 'user-1');

    expect(matchRows[0].team_a_id).toBe(SUED);
    expect(matchRows[0].team_b_id).toBe(NORD);
    expect(matchRows[0].team_a_placeholder).toBeNull();
  });

  it('@FU-001 Gegenbeispiel: Team-ID ohne passendes Team im Turnier wird trotzdem nicht als Text abgelegt', () => {
    const { matchRows } = mapTournamentToSupabase(
      { ...mapTournamentFromSupabase(createTournamentRow(), [], []), matches: [match()] },
      'user-1'
    );

    expect(matchRows[0].team_a_id).toBe(NORD);
    expect(matchRows[0].team_a_placeholder).toBeNull();
  });

  it('offene Seite schreibt keine Team-ID, nur die Herkunft', () => {
    const row = mapMatchToSupabase(
      match({
        slotA: pendingSlot({ kind: 'groupRank', group: 'A', rank: 1 }),
        slotB: pendingSlot({ kind: 'matchResult', matchId: HF1, role: 'winner' }),
      }),
      'tournament-1'
    );

    expect(row.team_a_id).toBeNull();
    expect(row.slot_a_source).toEqual({ kind: 'groupRank', group: 'A', rank: 1 });
    expect(row.team_b_id).toBeNull();
    expect(row.slot_b_source).toEqual({ kind: 'matchResult', matchId: HF1, role: 'winner' });
  });

  it('aufgelöste Seite schreibt Team-ID UND Herkunft', () => {
    const row = mapMatchToSupabase(
      match({ slotA: teamSlot(NORD, { kind: 'groupRank', group: 'A', rank: 1 }) }),
      'tournament-1'
    );

    expect(row.team_a_id).toBe(NORD);
    expect(row.slot_a_source).toEqual({ kind: 'groupRank', group: 'A', rank: 1 });
  });

  it('Spiel ohne Slot scheitert laut (kein Rückfall auf teamA)', () => {
    expect(() => mapMatchToSupabase(match({ slotA: undefined }), 'tournament-1')).toThrow(RepositoryError);
    expect(() => mapMatchToSupabase(match({ slotB: undefined }), 'tournament-1')).toThrow(/Seite B/);
  });
});

describe('A-02 mapMatchUpdateToSupabase – Slots nach Schlüssel-Regel', () => {
  it('Teamtausch erreicht die Cloud: getauschte Slots tauschen team_a_id/team_b_id', () => {
    const update = mapMatchUpdateToSupabase({ id: 'm1', slotA: teamSlot(SUED), slotB: teamSlot(NORD) });

    expect(update.team_a_id).toBe(SUED);
    expect(update.team_b_id).toBe(NORD);
    expect(update.slot_a_source).toBeNull();
    expect(update.slot_b_source).toBeNull();
  });

  it('Gegenbeispiel: ein Update ohne Slot-Schlüssel lässt beide Team-Spalten unberührt', () => {
    const update = mapMatchUpdateToSupabase(withStaleSides({ id: 'm1', field: 2 }, 'SV Süd', 'FC Nord'));

    expect(update).not.toHaveProperty('team_a_id');
    expect(update).not.toHaveProperty('team_b_id');
    expect(update).not.toHaveProperty('slot_a_source');
    expect(update).not.toHaveProperty('team_a_placeholder');
  });

  it('offene Seite im Update: Team-ID NULL, Herkunft gesetzt', () => {
    const source = { kind: 'matchResult', matchId: HF1, role: 'loser' } as const;
    const update = mapMatchUpdateToSupabase({ id: 'm1', slotB: pendingSlot(source) });

    expect(update.team_b_id).toBeNull();
    expect(update.slot_b_source).toEqual(source);
    expect(update).not.toHaveProperty('team_a_id');
  });

  it('aus der Warteschlange normalisiertes null (Schlüssel vorhanden) zählt als „nicht gesendet“', () => {
    const update = mapMatchUpdateToSupabase({ id: 'm1', slotA: null });

    expect(update).not.toHaveProperty('team_a_id');
    expect(update).not.toHaveProperty('slot_a_source');
  });
});

describe('A-03 (M3) mapMatchUpdateToSupabase – C2-Schutz: offene Seite setzt keine aufgelöste Cloud-Seite zurück', () => {
  const source = { kind: 'matchResult', matchId: HF1, role: 'winner' } as const;

  it('@TM-027 Gegenbeispiel: Update mit offenem Slot lässt die aufgelöste team_a_id stehen', () => {
    const update = mapMatchUpdateToSupabase(
      { id: 'm1', slotA: pendingSlot(source), slotB: teamSlot(SUED) },
      { team_a_id: NORD, team_b_id: SUED }
    );
    expect(update).not.toHaveProperty('team_a_id');
    expect(update).not.toHaveProperty('slot_a_source');
    expect(update.team_b_id).toBe(SUED);
  });

  it('@TM-027 Schutz gilt je Seite: auch die Gastseite bleibt, wenn sie in der Cloud besetzt ist', () => {
    const update = mapMatchUpdateToSupabase(
      { id: 'm1', slotB: pendingSlot(source) },
      { team_a_id: null, team_b_id: NORD }
    );
    expect(update).not.toHaveProperty('team_b_id');
    expect(update).not.toHaveProperty('slot_b_source');
  });

  it('@TM-027 offene Seite, Cloud ebenfalls offen: Herkunft wird geschrieben', () => {
    const update = mapMatchUpdateToSupabase({ id: 'm1', slotA: pendingSlot(source) }, { team_a_id: null, team_b_id: null });
    expect(update.team_a_id).toBeNull();
    expect(update.slot_a_source).toEqual(source);
  });

  it('@TM-027 Gegenbeispiel: besetzte lokale Seite überschreibt die Cloud-Seite (Teamtausch)', () => {
    const update = mapMatchUpdateToSupabase({ id: 'm1', slotA: teamSlot(SUED) }, { team_a_id: NORD, team_b_id: null });
    expect(update.team_a_id).toBe(SUED);
  });

  it('ohne Cloud-Stand (remote undefined) schreibt eine offene Seite wie bisher', () => {
    const update = mapMatchUpdateToSupabase({ id: 'm1', slotA: pendingSlot(source) });
    expect(update.team_a_id).toBeNull();
  });
});

describe('A-02 mapMatchToScheduleUpdate – Voll-Speichern setzt keine aufgelöste Seite zurück', () => {
  const pendingFinal = () =>
    mapMatchToSupabase(
      match({
        slotA: pendingSlot({ kind: 'matchResult', matchId: HF1, role: 'winner' }),
        slotB: teamSlot(SUED),
      }),
      'tournament-1'
    );

  it('@TM-027 Gegenbeispiel: lokal offene Seite überschreibt eine in der Cloud gesetzte Team-ID nicht', () => {
    const update = mapMatchToScheduleUpdate(pendingFinal(), { team_a_id: NORD, team_b_id: SUED });

    expect(update).not.toHaveProperty('team_a_id');
    expect(update).not.toHaveProperty('slot_a_source');
    expect(update.team_b_id).toBe(SUED);
  });

  it('@TM-027 lokal offene Seite, Cloud ebenfalls offen → Herkunft wird geschrieben', () => {
    const update = mapMatchToScheduleUpdate(pendingFinal(), { team_a_id: null, team_b_id: SUED });

    expect(update.team_a_id).toBeNull();
    expect(update.slot_a_source).toEqual({ kind: 'matchResult', matchId: HF1, role: 'winner' });
  });

  it('@TM-027 lokal besetzte Seite wird immer geschrieben (Leitung hat bewusst getauscht)', () => {
    const row = mapMatchToSupabase(match({ slotA: teamSlot(SUED), slotB: teamSlot(NORD) }), 'tournament-1');
    const update = mapMatchToScheduleUpdate(row, { team_a_id: NORD, team_b_id: SUED });

    expect(update.team_a_id).toBe(SUED);
    expect(update.team_b_id).toBe(NORD);
  });
});

describe('A-02 mapMatchFromSupabase – Slot aus Team-ID und Herkunft, ohne Namens-Map', () => {
  it('@TM-027 gesetzte Team-ID wird zum Team-Slot, kein Übergangsfeld teamA/teamB (A-36a)', () => {
    const m = mapMatchFromSupabase(createMatchRow({ team_a_id: NORD, team_b_id: SUED }));

    expect(m.slotA).toEqual({ kind: 'team', teamId: NORD });
    expect(m.slotB).toEqual({ kind: 'team', teamId: SUED });
    expect('teamA' in m || 'teamB' in m).toBe(false);
  });

  it('@TM-027 Team-ID + Herkunft → aufgelöster Slot; nur Herkunft → offener Slot', () => {
    const m = mapMatchFromSupabase(
      createMatchRow({
        team_a_id: NORD,
        slot_a_source: { kind: 'groupRank', group: 'A', rank: 1 },
        team_b_id: null,
        slot_b_source: { kind: 'matchResult', matchId: HF1, role: 'winner' },
      })
    );

    expect(m.slotA).toEqual({ kind: 'team', teamId: NORD, resolvedFrom: { kind: 'groupRank', group: 'A', rank: 1 } });
    expect(m.slotB).toEqual({ kind: 'pending', source: { kind: 'matchResult', matchId: HF1, role: 'winner' } });
  });

  it('Seite ohne Team-ID und ohne Herkunft scheitert laut', () => {
    expect(() => mapMatchFromSupabase(createMatchRow({ team_a_id: NORD, team_b_id: null }))).toThrow(RepositoryError);
  });

  it('Team-ID, die keine UUID ist, scheitert laut (kein Name als Team-ID)', () => {
    expect(() => mapMatchFromSupabase(createMatchRow({ team_a_id: 'FC Nord', team_b_id: SUED }))).toThrow(/keine UUID/);
  });

  it('ungültige Herkunft scheitert laut, auch wenn eine Team-ID gesetzt ist', () => {
    expect(() =>
      mapMatchFromSupabase(
        createMatchRow({
          team_a_id: NORD,
          team_b_id: SUED,
          slot_a_source: { kind: 'matchResult', matchId: 'semi1', role: 'winner' },
        })
      )
    ).toThrow(/Herkunft/);
  });

  it('Rundweg Lesen → Schreiben ist verlustfrei', () => {
    const source = { kind: 'matchResult', matchId: HF1, role: 'winner' } as const;
    const read = mapMatchFromSupabase(
      createMatchRow({ id: testUuid(300), team_a_id: null, slot_a_source: source, team_b_id: SUED })
    );
    const row = mapMatchToSupabase(read, 'tournament-1');

    expect(row.team_a_id).toBeNull();
    expect(row.slot_a_source).toEqual(source);
    expect(row.team_b_id).toBe(SUED);
  });
});
