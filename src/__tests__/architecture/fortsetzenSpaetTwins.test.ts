/**
 * 20261118_009 „Spiel fortsetzen“ spät (Befund C-REOPEN-NACH-ABPFIFF-SPAET, @SL-147 Z. 2, @ZM-180): Diff-Wächter und Zwillinge
 * Migration ↔ TS. Den Szenario-Beweis gegen echtes Postgres führen scripts/fortsetzen-spaet-check.sh,
 * scripts/append-match-events-check.sh (Abschnitt 9g) und scripts/rls-matrix.d/spur-zz-fortsetzen-spaet.sh; dieser Wächter hält fest:
 *  - append_match_events = Fassung 20261117_005 + NUR hinzugefügte Zeilen; Basisdatei unverändert (SHA-256),
 *  - die Fristen am Server = die Konstanten der Engine (CONTINUE_WINDOW_MS, SERVER_CLOCK_TOLERANCE_MS),
 *  - Rückweg = Funktionstext aus 20261117_005 wörtlich,
 *  - Rechte-Assertion, Drift-Check-Zuordnung; seit dem Einspielen (31.10.) steht die Migration nicht mehr in PENDING-LIVE.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { CONTINUE_WINDOW_MS, SERVER_CLOCK_TOLERANCE_MS } from '../../core/match/handlers/reopen';
import { functionBlock, latestBefore, lineDiff, readMigration } from './migrationFunctionDiff';

const ROOT = resolve(__dirname, '../../..');
const MIGRATION_NAME = '20261118_009_fortsetzen_spaet.sql';
const BASE = '20261117_005_klaerungsliste.sql';
const migration = readMigration(MIGRATION_NAME);
const rollback = readFileSync(resolve(ROOT, 'supabase/rollbacks/20261118_009_fortsetzen_spaet_rollback.sql'), 'utf8');
const drift = readFileSync(resolve(ROOT, 'scripts/db-drift-check.sh'), 'utf8');
const assertions = readFileSync(resolve(ROOT, 'scripts/db_privilege_assertions.sql'), 'utf8');
const pending = readFileSync(resolve(ROOT, 'supabase/migrations/PENDING-LIVE.txt'), 'utf8');
const FN = 'public.append_match_events';
const ASSERTION = 'fortsetzen-spaet-append-reopen-review';

describe('20261118_009: Diff-Wächter', () => {
  it('append_match_events baut auf 20261117_005 auf und hat nur hinzugefügte Zeilen', () => {
    expect(latestBefore(MIGRATION_NAME, FN)).toBe(BASE);
    const diff = lineDiff(functionBlock(readMigration(BASE), FN), functionBlock(migration, FN));
    expect(diff.removed).toEqual([]);
    expect(diff.added.length).toBeGreaterThan(0);
  });

  it('Basisdatei 20261117_005 unverändert (SHA-256)', () => {
    expect(createHash('sha256').update(readMigration(BASE)).digest('hex')).toBe('1d37a2959ce04dc243635b173e9261db9691f281ea3dadf17e595fac368f7216');
  });

  it('die Weiche zur Klärung steht nach der Rechenfunktion (eine Ablehnung bleibt Ablehnung) und nur für ein angenommenes REOPEN', () => {
    const body = functionBlock(migration, FN).join('\n');
    expect(body.indexOf("'CONTINUE_LATE'")).toBeGreaterThan(body.indexOf('public.match_continue(v_state'));
    expect(body).toContain("IF v_result ->> 'status' = 'accepted' AND v_reopen_late_ms IS NOT NULL THEN");
    expect(body).toContain("IF v_event ->> 'type' = 'REOPEN' AND v_actor = 'helper' THEN");
  });

  it('Rückweg = append_match_events aus 20261117_005 wörtlich, mit Wächter', () => {
    const base = functionBlock(readMigration(BASE), FN).join('\n');
    expect(rollback).toContain(base);
    expect(rollback).toContain("position('20261118_009' IN");
  });
});

describe('20261118_009: Zwillinge Migration ↔ TS', () => {
  it('Fristen am Server = Engine-Konstanten (2 Minuten, 10 Minuten Nachsende-Spielraum)', () => {
    const body = functionBlock(migration, FN).join('\n');
    expect(body).toContain(`c_continue_window_ms constant bigint := ${CONTINUE_WINDOW_MS};`);
    expect(body).toContain(`c_server_clock_tolerance_ms constant bigint := ${SERVER_CLOCK_TOLERANCE_MS};`);
  });
});

describe('20261118_009: Drift-Check (Rechte-Assertion, PENDING-LIVE)', () => {
  it('die Assertion steht in der SQL-Datei, in PRIVILEGE_ASSERTION_NAMES und in pending_assertions_for', () => {
    const mapping = drift.match(new RegExp(`    ${MIGRATION_NAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)\\n(?:\\s+#[^\\n]*\\n)*\\s+echo "([^"]+)"`));
    expect(mapping?.[1]).toBe(ASSERTION);
    expect(assertions).toContain(`SELECT '${ASSERTION}',`);
    expect(drift).toContain(`  "${ASSERTION}"`);
  });

  it('keine PENDING-LIVE-Zeile: 20261118_009 ist live (31.10., Daniel) – sonst ließe der Drift-Check die Assertion aus', () => {
    const files = pending
      .split('\n')
      .map((l) => l.replace(/#.*/, '').trim())
      .filter(Boolean)
      .map((l) => l.split(/\s+/)[0]);
    expect(files).not.toContain(MIGRATION_NAME);
  });
});
