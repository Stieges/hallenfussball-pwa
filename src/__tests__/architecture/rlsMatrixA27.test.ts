/**
 * A-27 Server-Szenarien (brief-A-27.md § 3.3): der Beleg läuft gegen echtes Postgres in scripts/rls-role-matrix.sh
 * (Zeilen in scripts/rls-matrix.d/spur-geraete-a27.sh, Pflicht-Check in der CI). Dieser Wächter hält fest, dass je
 * Kennung eine Ablehnungs-Zeile UND ein Gegenbeispiel stehen, dass die anonymen Identitäten den Claim is_anonymous
 * tragen und dass die Datei nach spur-a.sh läuft (sie nutzt dessen Fixtures). Er ersetzt den Matrix-Lauf nicht.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../..');
const a27 = readFileSync(resolve(ROOT, 'scripts/rls-matrix.d/spur-geraete-a27.sh'), 'utf8');
const matrix = readFileSync(resolve(ROOT, 'scripts/rls-role-matrix.sh'), 'utf8');

/** Beschriftungen `a11_mark "@KENNUNG <label>" ...` der Datei. */
function labels(kennung: string): string[] {
  return [...a27.matchAll(/^a11_mark "(@[A-Z0-9-]+ [^"]+)"/gm)]
    .map((m) => m[1].trim())
    .filter((l) => l.startsWith(`${kennung} `));
}

describe('A-27 Server-Zeilen der RLS-Matrix (scripts/rls-matrix.d/spur-geraete-a27.sh)', () => {
  it.each(['@HE-082', '@AN-045', '@HE-083', '@ME-059', '@ZP-084', '@HE-062', '@HE-084', '@ME-069', '@HE-073', '@HE-042'])(
    '%s: mindestens eine Ablehnungs-Zeile',
    (kennung) => {
      expect(labels(kennung).filter((l) => l.includes('abgelehnt')).length, kennung).toBeGreaterThan(0);
    },
  );

  it.each(['@HE-082', '@HE-083', '@ME-059', '@ZP-084', '@HE-062', '@HE-084', '@ME-069', '@HE-073', '@HE-042'])(
    '%s: mindestens ein Gegenbeispiel',
    (kennung) => {
      expect(labels(kennung).filter((l) => l.includes('gegen-')).length, kennung).toBeGreaterThan(0);
    },
  );

  it('@AN-006 @AN-005: Hook-Zeilen für anonym (entsteht) und Registrierung (abgelehnt)', () => {
    expect(labels('@AN-006').some((l) => l.includes('anonyme-geraetesitzung-entsteht'))).toBe(true);
    expect(labels('@AN-006').some((l) => l.includes('registrierung-email-abgelehnt'))).toBe(true);
    expect(labels('@AN-005').length).toBeGreaterThan(0);
  });

  it('@AN-006 Fixrunde 1 K1: Umwandlung einer Gerätesitzung in ein Konto abgelehnt, mit Gegenbeispielen', () => {
    expect(labels('@AN-006').some((l) => l.includes('lena-setzt-email-und-wird-konto-abgelehnt'))).toBe(true);
    expect(labels('@AN-006').some((l) => l.includes('gegen-olli-konto-aendert-email'))).toBe(true);
    expect(a27).toMatch(/widerrufener-helfer-zugang-hat-kein-schreibrecht/);
  });

  it('die anonymen Identitäten tragen den Claim is_anonymous (claims_line), owner-anonymous eingeschlossen', () => {
    expect(matrix).toMatch(/ANONYMOUS_UIDS=" \$\(uuid_for user:owner-anonymous\) \$U_ANON_DEVICE \$U_HELPER_DEVICE \$U_SCREEN_DEVICE \$U_ANON_COADMIN "/);
    expect(matrix).toMatch(/\\"is_anonymous\\":true/);
    expect(matrix).toMatch(/MATRIX_IDS=\([^)]*anon-device helper-device screen-device\)/);
  });

  it('die Datei läuft nach spur-a.sh (Glob-Reihenfolge), weil sie dessen Fixtures nutzt', () => {
    // Byte-Reihenfolge (macOS, C-Locale) UND eine Sortierung ohne Satzzeichen (glibc-Locale): spur-a.sh kommt zuerst.
    const files = readdirSync(resolve(ROOT, 'scripts/rls-matrix.d')).filter((n) => n.endsWith('.sh'));
    const ohneSatzzeichen = (n: string) => n.replace(/[^a-z0-9]/g, '');
    const byte = [...files].sort();
    const locale = [...files].sort((x, y) => (ohneSatzzeichen(x) < ohneSatzzeichen(y) ? -1 : 1));
    for (const order of [byte, locale]) {
      expect(order.indexOf('spur-a.sh')).toBeLessThan(order.indexOf('spur-geraete-a27.sh'));
    }
    expect(a27).toContain('$A11_M13');
  });
});
