/**
 * C-MATCHSTATUS-OHNE-PAUSED: Der TS-Typ `MatchStatus` kennt alle Werte, die die Cloud-Spalte
 * `matches.match_status` zulässt (CHECK `matches_match_status_check`), darunter `paused`.
 * Ohne `paused` im Typ ist keine Fallunterscheidung über den Status vollständig prüfbar (so
 * übersah `wornColors` die Halbzeit).
 *
 * Die Erwartung kommt aus der Datenbank-Definition (Baseline-Migration), nicht aus dem Code.
 * Gegenbeispiel: ein Wert, den die Spalte nicht zulässt (`decision_pending`: der Server schreibt
 * ihn als `paused`), steht nicht in der Liste.
 */
import { describe, it, expect, expectTypeOf } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MATCH_STATUSES, type MatchStatus } from '../tournament';

function cloudStatusValues(): string[] {
  const sql = readFileSync(
    resolve(__dirname, '../../../supabase/migrations/00000000000000_baseline_live_schema.sql'),
    'utf8',
  );
  const check = /CONSTRAINT "matches_match_status_check" CHECK \(\(.*?ARRAY\[(.*?)\]/.exec(sql);
  if (!check) {
    throw new Error('matches_match_status_check nicht gefunden');
  }
  return [...check[1].matchAll(/'([a-z_]+)'::"text"/g)].map((m) => m[1]);
}

describe('C-MATCHSTATUS-OHNE-PAUSED: MatchStatus deckt alle Cloud-Werte', () => {
  it('die Statusliste des Typs ist die der Spalte match_status (inkl. paused)', () => {
    expect([...MATCH_STATUSES].sort()).toEqual(cloudStatusValues().sort());
    expect(MATCH_STATUSES).toContain('paused');
  });

  it('der Typ MatchStatus enthält paused', () => {
    expectTypeOf<'paused'>().toExtend<MatchStatus>();
  });

  it('Gegenbeispiel: Engine-interne Werte stehen nicht im Typ (der Server schreibt sie als paused)', () => {
    for (const intern of ['section_break', 'decision_pending', 'shootout']) {
      expect(MATCH_STATUSES as readonly string[]).not.toContain(intern);
    }
  });
});
