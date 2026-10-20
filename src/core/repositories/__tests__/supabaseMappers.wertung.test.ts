/**
 * A-25c – Lesen der Nichtantritts-Wertung aus der Cloud (Plan GA4 v2 § 5 A-25c Punkt 5, § 15).
 * `matches.forfeit_absent` kommt erst mit Migration `20261110_005` (A-25b). Der Mapper liest die Spalte nur aus
 * `select('*')`-Zeilen und schreibt sie nie: keine explizite Spaltenliste nennt sie, sonst scheiterte die Abfrage vor
 * dem Einspielen (PostgREST 42703). Vor `_005` fehlt die Spalte in der Zeile ganz – das Spiel lädt trotzdem.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  mapMatchFromSupabase,
  mapMatchToScheduleUpdate,
  mapMatchToSupabase,
  mapMatchUpdateToSupabase,
} from '../supabaseMappers';
import { cloudRow } from '../../standings/__tests__/forfeitKit';
import { createMatchRow } from '../../../../tests/factories/supabase';
import { vs, testUuid } from '../../../test/matchSlotFixtures';
import type { Match } from '../../../types/tournament';

const MATCH: Match = { id: 'm-1', round: 1, field: 1, ...vs(testUuid(1), testUuid(2)), matchStatus: 'finished', scoreA: 2, scoreB: 0 };

describe('A-25c Mapper: forfeit_absent nur lesen', () => {
  it.each(['A', 'B', 'both'] as const)('Wertung „%s“ aus der Cloud-Zeile → decidedBy forfeit, forfeitAbsent', (absent) => {
    const match = mapMatchFromSupabase(cloudRow(MATCH, absent), '2026-12-06');
    expect(match.decidedBy).toBe('forfeit');
    expect(match.forfeitAbsent).toBe(absent);
  });

  it('vor _005 fehlt die Spalte in der Zeile: das Spiel lädt, ohne forfeitAbsent, das Ergebnis zählt wie gespeichert', () => {
    const row = cloudRow(MATCH, undefined, { withColumn: false });
    expect('forfeit_absent' in row).toBe(false);
    const match = mapMatchFromSupabase(row, '2026-12-06');
    expect(match.forfeitAbsent).toBeUndefined();
    expect([match.scoreA, match.scoreB, match.matchStatus]).toEqual([2, 0, 'finished']);
  });

  it('Gegenbeispiel: NULL oder ein unbekannter Wert ergibt keine Wertung', () => {
    expect(mapMatchFromSupabase(cloudRow(MATCH), '2026-12-06').forfeitAbsent).toBeUndefined();
    const odd = Object.assign(createMatchRow({ ...mapMatchToSupabase(MATCH, 't'), decided_by: 'forfeit' }), { forfeit_absent: 'C' });
    expect(mapMatchFromSupabase(odd, '2026-12-06').forfeitAbsent).toBeUndefined();
  });

  it('kein Schreibweg sendet forfeit_absent (die Spalte setzt nur append_match_events)', () => {
    const awarded: Match = { ...MATCH, decidedBy: 'forfeit', forfeitAbsent: 'B' };
    expect(Object.keys(mapMatchToSupabase(awarded, 't'))).not.toContain('forfeit_absent');
    expect(Object.keys(mapMatchToScheduleUpdate(mapMatchToSupabase(awarded, 't')))).not.toContain('forfeit_absent');
    expect(Object.keys(mapMatchUpdateToSupabase(awarded))).not.toContain('forfeit_absent');
  });
});

const SRC = join(__dirname, '..', '..', '..');

/** Kommentare entfernen, damit Erwähnungen in der Doku nicht als Leser zählen. */
const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === '__tests__' || name === '__fixtures__' || name === 'test' ? [] : sourceFiles(path);
    }
    return /\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe('A-25c Wächter: forfeit_absent in keiner Spaltenliste', () => {
  it('keine select-Liste und kein select= in src nennt forfeit_absent; gelesen wird die Spalte nur im Mapper-Baustein', () => {
    // Nur Dateien, die die Spalte überhaupt nennen; darin zählen Erwähnungen in Kommentaren nicht.
    const files = sourceFiles(SRC)
      .map((path) => ({ path: relative(SRC, path), raw: readFileSync(path, 'utf8') }))
      .filter(({ raw }) => raw.includes('forfeit_absent'))
      .map(({ path, raw }) => ({ path, source: withoutComments(raw) }));
    const inSelect = files.filter(({ source }) => /\.select\(\s*['"`][^'"`]*forfeit_absent|select=[^'"`&]*forfeit_absent/.test(source));
    expect(inSelect.map((f) => f.path)).toEqual([]);
    // Die erzeugten Datenbank-Typen nennen die Spalte nach dem Einspielen von `_005` (Skill supabase-types-regen).
    const readers = files.filter(({ source }) => source.includes('forfeit_absent')).map((f) => f.path)
      .filter((path) => path !== 'types/supabase.ts').sort();
    expect(readers).toEqual(['core/repositories/matchForfeitRow.ts']);
  }, 30_000); // liest den ganzen Quellbaum; unter Volllast > 5 s (wie die anderen Wächter)
});
