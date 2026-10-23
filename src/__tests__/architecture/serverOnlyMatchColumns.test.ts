/**
 * A-10 Wächter Zwillingsregel TS ↔ SQL (brief-A-10.md § 4). TS ist Referenz, SQL folgt.
 *
 * Z1 Schutzspalten: Spaltenliste in `matches_guard_engine_columns` (jüngste Fassung, seit A-25b 20261110_005) =
 *    `SERVER_ONLY_MATCH_COLUMNS`;
 *    die Client-Schreibwege für bestehende Spiele (`mapMatchUpdateToSupabase`, `mapMatchToScheduleUpdate`) senden keine.
 * Z2 Spielplan-Spalten: `WHEN`-Liste von `matches_bump_change_revision` = Schlüssel von `mapMatchToScheduleUpdate`
 *    ohne `updated_at` und die Altspalten `team_a/b_placeholder`.
 * Z3 Neutralwerte: INSERT-Zweig des Schutzes und `UPDATE` in `reset_match_results` = `NEUTRAL_RESULT_COLUMNS` (reset ohne
 *    `ENGINE_EVENT_ONLY_MATCH_COLUMNS`: ein Spiel mit Wertung hat Ereignisse, reset lehnt es mit HAS_ENTRIES ab);
 *    `mapMatchToSupabase` legt neue Spiele mit denselben Werten an; das lokale Zurücksetzen leert dieselben Felder.
 * Z4 „hat Einträge“: TS liest die Server-Revision (> 1, `ServerRevisionRegistry` → `matchesWithEntries`), SQL fragt
 *    `match_events.event_format IS NOT NULL`. Revisionen aus `scripts/guard-all-matches-check.sh` (Kategorie B, „Z4“):
 *    nur SKIP 2, nur zurückgenommenes Tor 2, Direkteintrag 2, Altbestand 1. Falle F3: `reset_match_results` erhöht
 *    `matches.version` nie (Container-Probe „Z4/F3“), sonst gälte ein zurückgesetztes Spiel in TS als „hat Einträge“.
 * Anforderungen: @EK-060, @FU-090, @TM-027.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { ENGINE_EVENT_ONLY_MATCH_COLUMNS, SERVER_ONLY_MATCH_COLUMNS, NEUTRAL_RESULT_COLUMNS } from '../../core/repositories/serverOnlyMatchColumns';
import { mapMatchToScheduleUpdate, mapMatchToSupabase, mapMatchUpdateToSupabase } from '../../core/repositories/supabaseMappers';
import { ServerRevisionRegistry } from '../../core/repositories/serverRevisionRegistry';
import { SERVER_LED_MATCH_FIELDS } from '../../core/repositories/serverLedMatchFields';
import { matchesWithEntries } from '../../core/services/matchResultStatusDiff';
import { resetResultFields } from '../../features/tournament-admin/hooks/useResultsReset';
import { createMockMatch } from '../../test/factories';
import { testTeamSlot } from '../../test/matchSlotFixtures';
import { testUuid } from '../../test/testIds';
import type { Match } from '../../types/tournament';

const MIGRATIONS_DIR = join(__dirname, '..', '..', '..', 'supabase', 'migrations');
const MIGRATION = readFileSync(join(MIGRATIONS_DIR, '20261028_005_guard_all_matches.sql'), 'utf8');
const GUARD_START = 'CREATE OR REPLACE FUNCTION public.matches_guard_engine_columns()';
/** A-25b: die jüngste Migration, die den Spalten-Schutz definiert (Dateinamen sortieren wie das Einspielen). */
const LATEST_GUARD_MIGRATION = readdirSync(MIGRATIONS_DIR)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => readFileSync(join(MIGRATIONS_DIR, name), 'utf8'))
  .filter((text) => text.includes(GUARD_START))
  .at(-1) ?? '';

/** Text zwischen zwei Markierungen (beide müssen genau einmal vorkommen). */
function between(text: string, start: string, end: string): string {
  const i = text.indexOf(start);
  expect(i, `Anfang „${start}“ fehlt`).toBeGreaterThanOrEqual(0);
  const j = text.indexOf(end, i + start.length);
  expect(j, `Ende „${end}“ fehlt`).toBeGreaterThan(i);
  return text.slice(i + start.length, j);
}

function sqlValue(raw: string): string | number | null {
  const v = raw.trim();
  if (v === 'NULL') { return null; }
  if (/^'.*'$/.test(v)) { return v.slice(1, -1); }
  return Number(v);
}

/** Ein Spiel, das jedes Feld trägt (auch Ergebnis, Uhr, Absetzen). */
function fullMatch(): Match {
  return createMockMatch({
    id: 'm-voll', round: 2, field: 1, slot: 3, group: 'A', isFinal: false, label: 'Spiel 7', matchNumber: 7, phase: 'groupStage',
    scheduledTime: new Date('1970-01-01T14:40:00'), referee: 2, slotA: testTeamSlot(testUuid(1)), slotB: testTeamSlot(testUuid(2)),
    scoreA: 2, scoreB: 1, overtimeScoreA: 1, overtimeScoreB: 0, penaltyScoreA: 4, penaltyScoreB: 3, matchStatus: 'finished',
    decidedBy: 'penalty', timerStartTime: '2026-10-28T14:40:00Z', timerPausedAt: '2026-10-28T14:50:00Z', timerElapsedSeconds: 600,
    finishedAt: '2026-10-28T14:52:00Z', skippedAt: '2026-10-28T14:00:00Z', skippedReason: 'Halle',
  });
}

describe('A-10 Zwillinge TS ↔ SQL (Spalten-Schutz, Spielplan-Zählung, Neutralwerte, „hat Einträge“)', () => {
  const guardBody = between(LATEST_GUARD_MIGRATION, GUARD_START, '$$;');

  it('Z1 die Schutzspalten des Guards = SERVER_ONLY_MATCH_COLUMNS (@EK-060)', () => {
    const guarded = [...guardBody.matchAll(/NEW\.(\w+) IS DISTINCT FROM OLD\.(\w+)/g)].map((m) => {
      expect(m[1]).toBe(m[2]);
      return m[1];
    });
    expect([...guarded].sort()).toEqual([...SERVER_ONLY_MATCH_COLUMNS].sort());
  });

  it('Z1 die Client-Schreibwege für bestehende Spiele senden keine Schutzspalte', () => {
    const match = fullMatch();
    const update = mapMatchUpdateToSupabase({ ...match });
    const schedule = mapMatchToScheduleUpdate(mapMatchToSupabase(match, 'T'));
    for (const column of SERVER_ONLY_MATCH_COLUMNS) {
      expect(update, `mapMatchUpdateToSupabase sendet ${column}`).not.toHaveProperty(column);
      expect(schedule, `mapMatchToScheduleUpdate sendet ${column}`).not.toHaveProperty(column);
    }
  });

  it('Z2 die WHEN-Liste von matches_bump_change_revision = Spielplan-Spalten von mapMatchToScheduleUpdate (@TM-027)', () => {
    const when = between(MIGRATION, 'CREATE TRIGGER matches_bump_change_revision', 'EXECUTE FUNCTION public.matches_bump_change_revision()');
    const counted = [...when.matchAll(/OLD\.(\w+) IS DISTINCT FROM NEW\.(\w+)/g)].map((m) => {
      expect(m[1]).toBe(m[2]);
      return m[1];
    });
    const scheduleKeys = Object.keys(mapMatchToScheduleUpdate(mapMatchToSupabase(fullMatch(), 'T')))
      .filter((key) => !['updated_at', 'team_a_placeholder', 'team_b_placeholder'].includes(key));
    expect([...counted].sort()).toEqual(scheduleKeys.sort());
  });

  it('Z3 INSERT-Zweig des Guards und UPDATE in reset_match_results setzen NEUTRAL_RESULT_COLUMNS', () => {
    const insertBranch = between(guardBody, "IF TG_OP = 'INSERT' THEN", 'ELSIF');
    const inserted = Object.fromEntries([...insertBranch.matchAll(/NEW\.(\w+) := ([^;]+);/g)].map((m) => [m[1], sqlValue(m[2])]));
    expect(inserted).toEqual(NEUTRAL_RESULT_COLUMNS);

    const resetUpdate = between(MIGRATION, 'UPDATE public.matches m SET', 'WHERE m.id = ANY (v_ids)');
    const assigned = Object.fromEntries(resetUpdate.split(',').map((part) => part.trim()).filter(Boolean)
      .map((part) => part.split('=').map((x) => x.trim()) as [string, string])
      .filter(([column]) => column !== 'updated_at')
      .map(([column, value]) => [column, sqlValue(value)]));
    const resetNeutral = Object.fromEntries(Object.entries(NEUTRAL_RESULT_COLUMNS)
      .filter(([column]) => !(ENGINE_EVENT_ONLY_MATCH_COLUMNS as readonly string[]).includes(column)));
    expect(assigned).toEqual(resetNeutral);
    expect(resetUpdate).not.toMatch(/\bversion\b/); // F3: matches.version bleibt
  });

  it('Z3 mapMatchToSupabase legt ein neues Spiel mit den Neutralwerten an (gesendete Schutzspalten)', () => {
    const row = mapMatchToSupabase(fullMatch(), 'T') as unknown as Record<string, unknown>;
    const sent = SERVER_ONLY_MATCH_COLUMNS.filter((column) => column in row);
    expect(sent.length).toBeGreaterThan(0);
    for (const column of sent) {
      expect(row[column], column).toEqual(NEUTRAL_RESULT_COLUMNS[column]);
    }
  });

  it('Z3 das lokale Zurücksetzen leert alle server-geführten Felder, Status „geplant“, Uhr leer', () => {
    const reset = resetResultFields(fullMatch());
    for (const field of SERVER_LED_MATCH_FIELDS) {
      if (field === 'matchStatus') { continue; }
      expect(reset[field], field).toBeUndefined();
    }
    expect(reset).toMatchObject({ matchStatus: 'scheduled', timerStartTime: undefined, timerPausedAt: undefined, timerElapsedSeconds: undefined });
    expect(reset.slotA).toEqual(fullMatch().slotA); // Spielplan bleibt
  });

  it('Z4 „hat Einträge“: nur SKIP / nur zurückgenommenes Tor / Direkteintrag → ja; Altbestand ohne Ereignisse (Revision 1) → nein', () => {
    const registry = new ServerRevisionRegistry();
    // Revisionen wie im Container gemessen (guard-all-matches-check.sh, Kategorie B „Z4“: 2|2|2|1).
    registry.record('T', new Map([['spiel-10', 2], ['spiel-11', 2], ['spiel-12', 2], ['spiel-3', 1]]));
    const tournament = { matches: ['spiel-3', 'spiel-10', 'spiel-11', 'spiel-12'].map((id) => ({ id })) };

    const withEntries = matchesWithEntries(tournament, registry.serverLedMatchIds('T')).map((m) => m.id);

    expect(withEntries).toEqual(['spiel-10', 'spiel-11', 'spiel-12']);
  });

  it('Z4/F3 nach reset_match_results bleibt Spiel 3 auf Revision 1 → in TS weiter „keine Einträge“', () => {
    const registry = new ServerRevisionRegistry();
    registry.record('T', new Map([['spiel-3', 1]]));
    registry.record('T', new Map([['spiel-3', 1]])); // Abruf nach dem Zurücksetzen: Revision unverändert

    expect(matchesWithEntries({ matches: [{ id: 'spiel-3' }] }, registry.serverLedMatchIds('T'))).toEqual([]);
  });
});
