/**
 * Wächter A-11 Fixrunde A6: `supabase/migrations/PENDING-LIVE.txt` (Migrationen, deren Code schon auf main ist, die aber
 * erst im DB-Fenster live gehen) liest NUR `scripts/db-drift-check.sh`. Alle anderen Prüfungen (RLS-Matrix, lokales
 * Einspielen, CI-Tests) spielen jede Migration weiter ein. Jede Zeile ist wohlgeformt, nennt eine vorhandene Datei, und
 * für jede gelistete Migration ist im Drift-Check die Zuordnung ihrer Rechte-Assertions hinterlegt.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../..');
const PENDING = join(ROOT, 'supabase/migrations/PENDING-LIVE.txt');
const DRIFT = join(ROOT, 'scripts/db-drift-check.sh');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

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

  it('nur scripts/db-drift-check.sh liest die Datei (RLS-Matrix, lokales Einspielen, CI spielen alles ein)', () => {
    const candidates = [...walk(join(ROOT, 'scripts')), ...walk(join(ROOT, '.github'))];
    const readers = candidates
      .filter((file) => readFileSync(file, 'utf8').includes('PENDING-LIVE'))
      .map((file) => relative(ROOT, file).split('\\').join('/'));
    expect(readers).toEqual(['scripts/db-drift-check.sh']);
  });
});
