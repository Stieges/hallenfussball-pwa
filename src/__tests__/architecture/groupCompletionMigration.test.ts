/**
 * A-13b-S „Gruppe abschließen“ am Server (task-GA4-plan-v2.md „A-13b-S“ Punkte 5, 8, 9; Anhang A Prüfpunkt 5): Wächter für
 * die Migration 20261110_006. Den Szenario-Beweis gegen echtes Postgres führt scripts/group-completion-check.sh
 * (P-1 … P-11, RT-*, Migrationsproben, Gegenprobe MG1–MG16); dieser Test hält fest:
 *  - der Rückweg im Kopf nennt jede Funktion, jeden Trigger, jede Tabelle und die Spalte, die die Migration anlegt,
 *  - „all“ steht im SQL nur in match_engine.group_key (eine Abbildung, R-GA4v2-7),
 *  - die zehn Hilfen in match_engine sind aus den Engine-Assertions ausgenommen (die Rechenfunktion bleibt bei 52),
 *  - die sechs neuen Rechte-Assertions stehen in SQL-Datei, Namensliste und Zuordnung; seit dem Einspielen (23.10.) nennt
 *    PENDING-LIVE die Datei nicht mehr.
 * Anforderungen: @TM-046, @TM-113, @W2A-070, @W2A-072, @TM-057.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../..');
const MIGRATION_NAME = '20261110_006_group_completion.sql';
const migration = readFileSync(resolve(ROOT, 'supabase/migrations', MIGRATION_NAME), 'utf8');
const drift = readFileSync(resolve(ROOT, 'scripts/db-drift-check.sh'), 'utf8');
const assertions = readFileSync(resolve(ROOT, 'scripts/db_privilege_assertions.sql'), 'utf8');
const pending = readFileSync(resolve(ROOT, 'supabase/migrations/PENDING-LIVE.txt'), 'utf8');

const withoutComments = migration.split('\n').map((line) => line.replace(/--.*$/, '')).join('\n');
const rollback = migration.slice(migration.indexOf('-- RÜCKWEG'), migration.indexOf('\nBEGIN;\n'));

const created = (pattern: RegExp): string[] => [...withoutComments.matchAll(pattern)].map((m) => m[1]);
const FUNCTIONS = created(/^CREATE OR REPLACE FUNCTION ([a-z0-9_]+\.[a-z0-9_]+)\(/gm);
const TRIGGERS = created(/^CREATE TRIGGER ([a-z0-9_]+)/gm);
const TABLES = created(/^CREATE TABLE IF NOT EXISTS public\.([a-z_]+)/gm);
const HELPERS = FUNCTIONS.filter((f) => f.startsWith('match_engine.')).map((f) => f.replace('match_engine.', ''));

describe('A-13b-S Migration 20261110_006: Rückweg und Lesarten', () => {
  it('legt 19 Funktionen, 3 Trigger und 4 Tabellen an (Anhang A)', () => {
    expect([FUNCTIONS.length, TRIGGERS.length, TABLES.length]).toEqual([19, 3, 4]);
  });

  it('Auflage 11: der Rückweg-Block nennt jede Funktion, jeden Trigger, jede Tabelle und reassigned_at', () => {
    for (const name of [...FUNCTIONS, ...TRIGGERS, ...TABLES.map((t) => `public.${t}`)]) {
      expect(rollback, name).toContain(name);
    }
    expect(rollback).toContain('DROP COLUMN IF EXISTS reassigned_at');
  });

  it('Prüfpunkt 5 (R-GA4v2-7): „all“ steht nur in match_engine.group_key', () => {
    const lines = withoutComments.split('\n').filter((line) => line.includes("'all'"));
    expect(lines).toHaveLength(1);
    const keyFn = withoutComments.slice(withoutComments.indexOf('CREATE OR REPLACE FUNCTION match_engine.group_key('));
    expect(keyFn.slice(0, keyFn.indexOf('$$;'))).toContain(lines[0].trim());
  });

  it('Sperrreihenfolge R-GA4v2-8: complete_group sperrt die Spiele vor dem Turnier und dem Abschluss', () => {
    const body = withoutComments.slice(withoutComments.indexOf('CREATE OR REPLACE FUNCTION public.complete_group('));
    const fn = body.slice(0, body.indexOf('\n$$;'));
    const matches = fn.indexOf('ORDER BY m.id\n   FOR UPDATE;');
    const tournament = fn.indexOf('FROM public.tournaments WHERE id = p_tournament_id AND deleted_at IS NULL FOR UPDATE');
    const completion = fn.indexOf('FROM public.group_completions\n   WHERE tournament_id = p_tournament_id AND group_id = p_group_id FOR UPDATE');
    expect(matches).toBeGreaterThan(0);
    expect(matches).toBeLessThan(tournament);
    expect(tournament).toBeLessThan(completion);
  });
});

describe('A-13b-S Rechte-Assertions und Drift-Check', () => {
  const NAMES = [
    'group-completion-tables-no-client-writes',
    'group-completion-rpcs-definer-authenticated-only',
    'group-completion-helpers-no-client-execute',
    'complete-group-locks-matches-before-tournament',
    'group-completion-triggers',
    'ci-schema-reader-select-group-completion',
  ];

  it('die sechs Assertions stehen in der SQL-Datei, in PRIVILEGE_ASSERTION_NAMES und in pending_assertions_for', () => {
    const mapping = drift.match(new RegExp(`    ${MIGRATION_NAME.replace(/\./g, '\\.')}\\)\\n\\s+echo "([^"]+)"`));
    expect(mapping?.[1].split(' ').sort()).toEqual([...NAMES].sort());
    for (const name of NAMES) {
      expect(assertions).toContain(`SELECT '${name}',`);
      expect(drift).toContain(`  "${name}"`);
    }
  });

  it('die Engine-Assertions (52/51/52, Ausführbarkeit) nehmen genau die zehn neuen Hilfen aus', () => {
    expect(HELPERS).toHaveLength(10);
    const list = `(${HELPERS.map((h) => `'${h}'`).join(', ')})`;
    for (const name of ['match-engine-function-count-52', 'match-engine-immutable-count-51', 'match-engine-search-path-all-52',
      'match-engine-non-b3b-executable-anon-authenticated']) {
      const start = assertions.indexOf(`SELECT '${name}',`);
      const block = assertions.slice(start, assertions.indexOf('UNION ALL', start));
      expect(block, name).toContain(`p.proname NOT IN ${list}`);
    }
  });

  it('keine PENDING-LIVE-Zeile: 20261110_006 ist live (vorgezogenes Fenster 23.10.) – sonst ließe der Drift-Check die Assertions aus', () => {
    const files = pending
      .split('\n')
      .map((l) => l.replace(/#.*/, '').trim())
      .filter(Boolean)
      .map((l) => l.split(/\s+/)[0]);
    expect(files).not.toContain(MIGRATION_NAME);
  });
});
