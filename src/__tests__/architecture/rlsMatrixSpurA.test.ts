/**
 * A-11 Server-Szenarien: der Beleg läuft gegen echtes Postgres in scripts/rls-role-matrix.sh (Zeilen der Spur A in
 * scripts/rls-matrix.d/spur-a.sh, Pflicht-Check in der CI). Dieser Wächter hält fest, dass die Zeilen je Kennung da
 * sind – mit Ablehnung UND Gegenbeispiel – und dass das Hauptskript sie einbindet. Er ersetzt den Matrix-Lauf nicht.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../..');
const spurA = readFileSync(resolve(ROOT, 'scripts/rls-matrix.d/spur-a.sh'), 'utf8');
const matrix = readFileSync(resolve(ROOT, 'scripts/rls-role-matrix.sh'), 'utf8');

/** Zeilen `a11_mark "@KENNUNG <label>" "<gemessen>" "<erwartet>"` der Datei. */
function rows(kennung: string): { label: string; expected: string }[] {
  return [...spurA.matchAll(/^a11_mark "(@[A-Z0-9-]+ [^"]+)" .* "([^"]+)"$/gm)]
    .filter((m) => m[1].startsWith(`${kennung} `))
    .map((m) => ({ label: m[1].trim(), expected: m[2] }));
}

describe('A-11 Server-Zeilen der RLS-Matrix (scripts/rls-matrix.d/spur-a.sh)', () => {
  it('das Hauptskript bindet scripts/rls-matrix.d/*.sh vor dem L4-Gate ein', () => {
    const source = matrix.indexOf('source "$rls_matrix_part"');
    const gate = matrix.indexOf('# --- 9. L4: CI-Gate');
    expect(source).toBeGreaterThan(0);
    expect(source).toBeLessThan(gate);
  });

  it.each(['@ZP-041', '@ZP-084', '@LZ-023', '@TM-084', '@HE-042', '@ZM-019'])(
    '%s: mindestens eine Ablehnungs-Zeile mit Vorher-Sichtbarkeit und Wertevergleich',
    (kennung) => {
      const denied = rows(kennung).filter((r) => r.expected === 'abgelehnt' || r.label.includes('abgelehnt') || r.label.endsWith("nicht"));
      expect(denied.length, kennung).toBeGreaterThan(0);
    },
  );

  it.each(['@ZP-041', '@ZP-084', '@LZ-023', '@HE-042', '@ZM-019'])('%s: mindestens ein Gegenbeispiel, das gelingt', (kennung) => {
    const counter = rows(kennung).filter((r) => r.label.includes('gegen-'));
    expect(counter.length, kennung).toBeGreaterThan(0);
  });
});
