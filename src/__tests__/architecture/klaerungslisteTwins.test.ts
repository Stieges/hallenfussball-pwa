/**
 * A-35 Klärungsliste – Server (20261117_005_klaerungsliste.sql): Diff-Wächter und Zwillinge Migration ↔ TS. Den
 * Szenario-Beweis gegen echtes Postgres führen scripts/klaerungsliste-check.sh und scripts/match-engine-parity.sh
 * (Fixtures 71a–71e); dieser Wächter hält fest:
 *  - append_match_events = Fassung 20261113_003 (closed_intake auf 20261110_009) + NUR hinzugefügte Zeilen,
 *  - match_apply_event = Fassung 20261110_005 + NUR hinzugefügte Zeilen (Schritt 3a, Kopie im beendeten Spiel),
 *  - beide Basisdateien unverändert (SHA-256), Fail-fast verlangt die _003-Fassung,
 *  - Übergänge REVIEW_* gleich in matchTransitions.json und Migration, Eintragsarten gleich in TS und SQL,
 *  - Rechte-Assertions, Drift-Check-Zuordnung; seit dem Einspielen (24.10.) steht die Migration nicht mehr in PENDING-LIVE.
 * Anforderungen: @FU-036, @FU-037, @FU-038, @FU-095, @FU-017, @FU-116, @HE-056, @HE-080.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import matchTransitions from '../../core/match/matchTransitions.json';
import { REVIEW_COPY_TYPES } from '../../core/match/handlers/reviewCopy';
import { MatchStatusSchema } from '../../core/match/types';
import { functionBlock, latestBefore, lineDiff, readMigration } from './migrationFunctionDiff';

const ROOT = resolve(__dirname, '../../..');
const MIGRATION_NAME = '20261117_005_klaerungsliste.sql';
const APPEND_BASE = '20261113_003_tournament_lifecycle.sql';
const APPLY_BASE = '20261110_005_result_entry_forfeit.sql';
/** Basis-Dateien unverändert (A-21a-S Nachblick: _003 `c6e50998…`, _005 `889b1334…`). */
const BASE_SHA256: Record<string, string> = {
  [APPEND_BASE]: 'c6e50998d4ce160b618cafdbf65a44f0eba0c7f7cd15852c1b488ac5258218c5',
  [APPLY_BASE]: '889b13348822eb8f6d88630a06a1abd1f1a56b4271559f8e25e8ecd5ffe75a11',
};
const migration = readMigration(MIGRATION_NAME);
const drift = readFileSync(resolve(ROOT, 'scripts/db-drift-check.sh'), 'utf8');
const assertions = readFileSync(resolve(ROOT, 'scripts/db_privilege_assertions.sql'), 'utf8');
const pending = readFileSync(resolve(ROOT, 'supabase/migrations/PENDING-LIVE.txt'), 'utf8');
const ASSERTIONS = [
  'klaerungsliste-tables-rls-no-client-writes',
  'klaerungsliste-select-policy',
  'klaerungsliste-helpers-no-client-execute',
  'klaerungsliste-rpc-definer-authenticated-only',
  'klaerungsliste-append-routes-reviews',
];

describe('A-35: Diff-Wächter der ersetzten Funktionen', () => {
  it.each([
    ['public.append_match_events', APPEND_BASE],
    ['public.match_apply_event', APPLY_BASE],
    ['match_engine.closed_intake', APPEND_BASE],
  ])('%s baut auf %s auf und hat nur hinzugefügte Zeilen', (fn, base) => {
    expect(latestBefore(MIGRATION_NAME, fn)).toBe(base);
    const diff = lineDiff(functionBlock(readMigration(base), fn), functionBlock(migration, fn));
    expect(diff.removed).toEqual([]);
    expect(diff.added.length).toBeGreaterThan(0);
  });

  it.each(Object.entries(BASE_SHA256))('%s ist unverändert (SHA-256)', (name, sha) => {
    expect(createHash('sha256').update(readMigration(name)).digest('hex')).toBe(sha);
  });

  it('closed_intake (A-21a) bleibt vor dem field_control-INSERT, die Weiche steht vor der Rechenfunktion', () => {
    const body = functionBlock(migration, 'public.append_match_events').join('\n');
    expect(body.indexOf('match_engine.closed_intake(')).toBeGreaterThan(0);
    expect(body.indexOf('match_engine.closed_intake(')).toBeLessThan(body.indexOf('INSERT INTO public.field_control'));
    expect(body.indexOf('match_engine.review_route(')).toBeLessThan(body.indexOf('public.match_continue(v_state'));
    expect(body.indexOf('match_engine.revoked_intake(')).toBeLessThan(body.indexOf("'FORBIDDEN_ACTOR') ORDER BY ord)"));
  });

  it('Fail-fast verlangt die Fassung 20261113_003 (closed_intake UND v_end_by_lead UND Feldsteuerung)', () => {
    const failFast = migration.slice(migration.indexOf('DO $$'), migration.indexOf('END;\n$$;'));
    for (const marker of ["position('match_engine.closed_intake(' IN v_append) > 0", "position('IF NOT v_end_by_lead' IN v_append) > 0",
      "position('INSERT INTO public.field_control' IN v_append) > 0", "position('''@reopen''' IN v_apply) = 0"]) {
      expect(failFast, marker).toContain(marker);
    }
  });
});

describe('A-35: Zwillinge Migration ↔ TS', () => {
  it('@FU-038 @FU-095 Übergänge REVIEW_ACCEPT/REVIEW_DISCARD: Turnierleitung, alle acht Zustände, Ziel „=“ – JSON = Migration', () => {
    const fromJson = matchTransitions.transitions
      .filter((row) => row.type === 'REVIEW_ACCEPT' || row.type === 'REVIEW_DISCARD')
      .map((row) => `${row.from}|${row.type}|${row.actor}|${row.to}`)
      .sort();
    const expected = MatchStatusSchema.options.flatMap((from) => [`${from}|REVIEW_ACCEPT|leitung|=`, `${from}|REVIEW_DISCARD|leitung|=`]).sort();
    expect(fromJson).toEqual(expected);
    const fromSql = [...migration.matchAll(/\('([a-z_]+)', '(REVIEW_[A-Z]+)', '([a-z]+)', '(=)'\)/g)].map((m) => `${m[1]}|${m[2]}|${m[3]}|${m[4]}`).sort();
    expect(fromSql).toEqual(expected);
  });

  it('@FU-037 @FU-095 dieselben Eintragsarten in TS (reviewCopy.ts) und an allen vier SQL-Stellen', () => {
    const ts = [...REVIEW_COPY_TYPES].sort();
    const lists = [...migration.matchAll(/(?:ARRAY\[|v_type IN \()('GOAL', 'OWN_GOAL'[^\])]*)/g)].map((m) =>
      [...m[1].matchAll(/'([A-Z_]+)'/g)].map((x) => x[1]).sort(),
    );
    expect(lists.length).toBe(4);
    for (const list of lists) {
      expect(list).toEqual(ts);
    }
  });
});

describe('A-35: Drift-Check (Rechte-Assertions, PENDING-LIVE)', () => {
  it('die Assertions stehen in der SQL-Datei, in PRIVILEGE_ASSERTION_NAMES und in pending_assertions_for', () => {
    const mapping = drift.match(new RegExp(`    ${MIGRATION_NAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)\\n\\s+echo "([^"]+)"`));
    expect(mapping?.[1]).toBe(ASSERTIONS.join(' '));
    for (const name of ASSERTIONS) {
      expect(assertions).toContain(`SELECT '${name}',`);
      expect(drift).toContain(`  "${name}"`);
    }
  });

  it('keine PENDING-LIVE-Zeile: 20261117_005 ist live (24.10., Daniel) – sonst ließe der Drift-Check die Assertions aus', () => {
    const files = pending
      .split('\n')
      .map((l) => l.replace(/#.*/, '').trim())
      .filter(Boolean)
      .map((l) => l.split(/\s+/)[0]);
    expect(files).not.toContain(MIGRATION_NAME);
  });
});
