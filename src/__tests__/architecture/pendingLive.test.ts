/**
 * Wächter A-11 Fixrunde A6: `supabase/migrations/PENDING-LIVE.txt` (Migrationen, deren Code schon auf main ist, die aber
 * erst im DB-Fenster live gehen) liest NUR `scripts/db-drift-check.sh`. Alle anderen Prüfungen (RLS-Matrix, lokales
 * Einspielen, CI-Tests) spielen jede Migration weiter ein. Jede Zeile ist wohlgeformt, nennt eine vorhandene Datei, und
 * für jede gelistete Migration ist im Drift-Check die Zuordnung ihrer Rechte-Assertions hinterlegt.
 */
import { describe, it, expect } from 'vitest';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../..');
const PENDING = join(ROOT, 'supabase/migrations/PENDING-LIVE.txt');
const DRIFT = join(ROOT, 'scripts/db-drift-check.sh');

const entries = readFileSync(PENDING, 'utf8')
  .split('\n')
  .map((line) => line.replace(/#.*/, '').trim())
  .filter((line) => line.length > 0);

describe('A-11 A6: PENDING-LIVE nur für den Drift-Check', () => {
  it('jede Zeile: <dateiname> <frist YYYY-MM-DD> <commit-vorher>, die Migration gibt es', () => {
    for (const line of entries) {
      const parts = line.split(/\s+/);
      expect(parts, line).toHaveLength(3);
      const [file, due, commit] = parts;
      expect(existsSync(join(ROOT, 'supabase/migrations', file)), file).toBe(true);
      expect(due, line).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(commit, line).toMatch(/^[0-9a-f]{40}$/);
    }
  });

  it('der Drift-Check kennt für jede gelistete Migration die Zuordnung ihrer Rechte-Assertions', () => {
    const drift = readFileSync(DRIFT, 'utf8');
    for (const line of entries) {
      const file = line.split(/\s+/)[0];
      expect(drift, file).toContain(`    ${file})`);
    }
  });

  // @TA-021 (Befund C-PENDINGLIVE-TEST-FLAKE): früher las der Test jede Datei unter scripts/ und .github/ einzeln im
  // Vitest-Worker – unter der Last des Commit-Hooks über die 5-s-Grenze. `git grep` sucht in einem nativen Aufruf über
  // dieselben Dateien (eingecheckte und neue, nicht ignorierte), ohne die Zeitgrenze anzuheben.
  it('@TA-021 nur scripts/db-drift-check.sh liest die Datei (RLS-Matrix, lokales Einspielen, CI spielen alles ein)', () => {
    const suche = spawnSync('git', ['grep', '-l', '--untracked', '--fixed-strings', 'PENDING-LIVE', '--', 'scripts', '.github'], { cwd: ROOT, encoding: 'utf8' });
    expect(suche.error).toBeUndefined();
    expect([0, 1], suche.stderr).toContain(suche.status);
    const readers = suche.stdout.split('\n').filter(Boolean).sort();
    expect(readers).toEqual(['scripts/db-drift-check.sh']);
  });
});

/**
 * Review A-11-fix L3: Die Fristprüfung läuft wirklich. Das Skript läuft in einer Kopie (scripts + supabase/migrations)
 * mit gefälschten docker/psql/pg_dump/supabase (Exit 97 = „bis zum Container gekommen“) -- kein Container, kein Netz.
 */
describe('A-11 A6: Fristprüfung im Drift-Check (L3)', () => {
  const FAKE_EXIT = 97;
  const LISTED = '20261110_001_role_permissions_mvp.sql';

  function runWithDue(due: string): { status: number | null; out: string } {
    const dir = mkdtempSync(join(tmpdir(), 'pending-live-'));
    try {
      mkdirSync(join(dir, 'scripts/lib'), { recursive: true });
      cpSync(DRIFT, join(dir, 'scripts/db-drift-check.sh'));
      cpSync(join(ROOT, 'scripts/lib/migrations-since-baseline.sh'), join(dir, 'scripts/lib/migrations-since-baseline.sh'));
      cpSync(join(ROOT, 'supabase/migrations'), join(dir, 'supabase/migrations'), { recursive: true });
      writeFileSync(join(dir, 'supabase/migrations/PENDING-LIVE.txt'), `${LISTED} ${due} ${'a'.repeat(40)}\n`);
      const bin = join(dir, 'bin');
      mkdirSync(bin);
      for (const tool of ['docker', 'psql', 'pg_dump', 'supabase']) {
        writeFileSync(join(bin, tool), `#!/bin/sh\necho "FAKE-${tool}" >&2\nexit ${FAKE_EXIT}\n`);
        chmodSync(join(bin, tool), 0o755);
      }
      const run = spawnSync('bash', [join(dir, 'scripts/db-drift-check.sh'), '--live-dump-file', join(dir, 'leer.sql')], {
        env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ''}`, SUPABASE_DB_READONLY_URL: '' },
        encoding: 'utf8',
        timeout: 30_000,
      });
      return { status: run.status, out: `${run.stdout}${run.stderr}` };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  const isoDay = (offsetDays: number): string => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

  // Eigener Prozess (bash + Kopie der Migrationen): unter Last der ganzen Suite länger als die 5-s-Vorgabe.
  const SCRIPT_TEST_TIMEOUT_MS = 60_000;

  it('Frist gestern (UTC): harter Abbruch mit klarer Meldung, bevor ein Container startet', () => {
    const { status, out } = runWithDue(isoDay(-1));
    expect(status).toBe(1);
    expect(out).toContain(`Frist ${isoDay(-1)} für ${LISTED} überschritten`);
    expect(out).not.toContain('FAKE-docker');
  }, SCRIPT_TEST_TIMEOUT_MS);

  it('Gegenbeispiel: Frist morgen – die Ausnahme wird gedruckt und der Lauf geht bis zum Container weiter', () => {
    const { status, out } = runWithDue(isoDay(1));
    expect(out).toContain(`PENDING-LIVE: ausgenommen bis ${isoDay(1)} (noch nicht live): ${LISTED}`);
    expect(out).toContain('FAKE-docker');
    expect(status).toBe(FAKE_EXIT);
  }, SCRIPT_TEST_TIMEOUT_MS);
});
