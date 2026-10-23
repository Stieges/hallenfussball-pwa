/**
 * Hilfen für die Zwillings-Wächter der Migrationen (Muster forfeitTwins.test.ts): Funktionsblock wörtlich und
 * Zeilen-Diff über die längste gemeinsame Teilfolge.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

export const MIGRATIONS = resolve(__dirname, '../../../supabase/migrations');
export const readMigration = (name: string): string => readFileSync(resolve(MIGRATIONS, name), 'utf8');

/** Funktionsblock wörtlich: ab „CREATE OR REPLACE FUNCTION <fn>(“ bis zur Zeile „$$;“; leer, wenn er fehlt. */
export function functionBlock(text: string, fn: string): string[] {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.startsWith(`CREATE OR REPLACE FUNCTION ${fn}(`));
  if (start < 0) {
    return [];
  }
  const end = lines.findIndex((line, i) => i > start && line === '$$;');
  return lines.slice(start, end + 1);
}

/** Zeilen-Diff (LCS): entfernte und hinzugefügte Zeilen, getrimmt, in Reihenfolge. */
export function lineDiff(before: string[], after: string[]): { removed: string[]; added: string[] } {
  const n = before.length;
  const m = after.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[i][j] = before[i] === after[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const removed: string[] = [];
  const added: string[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (before[i] === after[j]) {
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      removed.push(before[i].trim());
      i += 1;
    } else {
      added.push(after[j].trim());
      j += 1;
    }
  }
  return { removed: [...removed, ...before.slice(i).map((l) => l.trim())], added: [...added, ...after.slice(j).map((l) => l.trim())] };
}

/** Die jüngste Migration VOR `migrationName`, die eine Funktion definiert (Dateinamen sortiert wie beim Einspielen). */
export function latestBefore(migrationName: string, fn: string): string {
  const names = readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith('.sql') && name < migrationName && !name.startsWith('00000000000000'))
    .sort();
  return names.filter((name) => readMigration(name).includes(`CREATE OR REPLACE FUNCTION ${fn}(`)).at(-1) ?? '';
}
