/**
 * Gegenbeispiel-Test zur Ein-Stellen-Regel (B-28a1): Spielseiten liest nur `matchSides.ts`.
 * Prüft den Quelltext von `src/lib/pdf/**` ohne `__tests__`, kein Laufzeit-Verhalten.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const PDF_DIR = fileURLToPath(new URL('..', import.meta.url));
const TEAM_FIELD = /\b(homeTeam|awayTeam|originalTeam)\b/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : sourceFiles(path);
    }
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

describe('Ein-Stellen-Regel Spielseiten (B-28a1)', () => {
  const files = sourceFiles(PDF_DIR);
  const withTeamFields = files
    .filter(file => TEAM_FIELD.test(readFileSync(file, 'utf8')))
    .map(file => relative(PDF_DIR, file));

  it('Pflichtnachweis: der Scan findet Quelldateien und die Ein-Stelle-Datei', () => {
    expect(files.length).toBeGreaterThan(0);
    expect(withTeamFields).toContain('matchSides.ts');
  });

  it('Gegenbeispiel: homeTeam/awayTeam/originalTeam kommen außerhalb von matchSides.ts nicht vor', () => {
    expect(withTeamFields.filter(file => file !== 'matchSides.ts')).toEqual([]);
  });
});
