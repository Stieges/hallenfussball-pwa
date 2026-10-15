/**
 * @OB-055 — Architektur-Wächter: Portal und role="dialog" gibt es außerhalb von
 * DialogSurface nur noch so viele Stellen wie heute (Inventar B-43, Obergrenze 42).
 * Die Zahl darf nur sinken; B-43b senkt sie auf die begründeten Ausnahmen.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Stand B-43 (Inventar: B-43-inventar.md, Abschnitt Zusammenfassung). */
const OBERGRENZE = 42;
const MARKER = /role="(dialog|alertdialog)"|createPortal\(/;

const SRC = resolve(process.cwd(), 'src');

function produktivDateien(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === '__tests__' || name === 'test' || name === 'node_modules') {continue;}
      out.push(...produktivDateien(full));
    } else if (/\.(tsx?)$/.test(name) && !/\.test\.|\.spec\./.test(name)) {
      out.push(full);
    }
  }
  return out;
}

describe('@OB-055 Architektur-Wächter DialogSurface', () => {
  it('Portal und role="dialog" außerhalb von DialogSurface nicht mehr als Obergrenze', () => {
    const treffer: string[] = [];
    for (const file of produktivDateien(SRC)) {
      if (file.endsWith('DialogSurface.tsx')) {continue;}
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (MARKER.test(line)) {treffer.push(`${file}:${i + 1}`);}
        });
    }
    expect(treffer.length, treffer.join('\n')).toBeLessThanOrEqual(OBERGRENZE);
  }, 60_000); // Dateibaum-Lauf unter Hook-Last (parallele Worker)
});
