/**
 * A-34 Steuer je Feld (brief-A-34.md): Zwillinge Migration ↔ TS und Verdrahtung der Prüfungen. Der Beleg der Szenarien
 * läuft gegen echtes Postgres in scripts/field-control-check.sh und scripts/rls-matrix.d/spur-steuer-a34.sh; dieser
 * Wächter hält fest, dass
 *  - der Ablehnungscode der Migration im Client bekannt ist (Text „Ein anderes Gerät steuert dieses Spiel gerade.“),
 *  - die „laufenden“ Zustände der Migration genau die gestarteten, nicht beendeten Zustände der Rechenfunktion sind,
 *  - die Migration im Drift-Check bis F3 ausgenommen ist und ihre drei Rechte-Assertions zugeordnet sind,
 *  - je Kennung im Prüfskript eine Zeile und ein Gegenbeispiel stehen und die Matrix-Datei nach A-27 läuft.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ERROR_CODES, MatchStatusSchema } from '../../core/match/types';

const ROOT = resolve(__dirname, '../../..');
const MIGRATION_NAME = '20261110_003_field_control.sql';
const migration = readFileSync(resolve(ROOT, 'supabase/migrations', MIGRATION_NAME), 'utf8');
const check = readFileSync(resolve(ROOT, 'scripts/field-control-check.sh'), 'utf8');
const drift = readFileSync(resolve(ROOT, 'scripts/db-drift-check.sh'), 'utf8');
const assertions = readFileSync(resolve(ROOT, 'scripts/db_privilege_assertions.sql'), 'utf8');
const pending = readFileSync(resolve(ROOT, 'supabase/migrations/PENDING-LIVE.txt'), 'utf8');
const deDe = JSON.parse(readFileSync(resolve(ROOT, 'src/i18n/locales/de/common.json'), 'utf8')) as {
  outbox: { rejection: Record<string, string> };
};

const A34_ASSERTIONS = [
  'field-control-no-client-access',
  'field-control-rpcs-execute-only-authenticated',
  'append-match-events-checks-field-control',
];

describe('A-34 Zwillinge Migration ↔ Client', () => {
  it('@FU-026 der Ablehnungscode NOT_CONTROLLER ist im Client bekannt und hat einen Text', () => {
    const codes = [...migration.matchAll(/'code', '([A-Z_]+)'/g)].map((m) => m[1]);
    expect(codes).toContain('NOT_CONTROLLER');
    expect(Object.values(ERROR_CODES)).toContain('NOT_CONTROLLER');
    expect(deDe.outbox.rejection.NOT_CONTROLLER).toBe('Ein anderes Gerät steuert dieses Spiel gerade.');
  });

  it('Auflage § 20: „laufend“ heißt gestartet und nicht beendet – dieselben Zustände wie in der Rechenfunktion', () => {
    const m = migration.match(/c_live_states constant text\[\] := ARRAY\[([^\]]+)\]/);
    expect(m).not.toBeNull();
    const live = [...(m?.[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
    const notLive = new Set(['scheduled', 'finished', 'skipped']);
    expect(live).toEqual(MatchStatusSchema.options.filter((s) => !notLive.has(s)).sort());
  });

  it('Anpfiff und Wiedereröffnen brauchen die Steuer auch an nicht laufenden Spielen (brief L5/L6)', () => {
    expect(migration).toContain("v_event ->> 'type' IN ('MATCH_START', 'REOPEN')");
  });
});

describe('A-34 Drift-Check bis F3 (PENDING-LIVE, Rechte-Assertions)', () => {
  it('PENDING-LIVE nennt die Migration mit Frist 2026-11-10 und demselben Vergleichs-Commit wie die übrigen Zeilen', () => {
    const lines = pending
      .split('\n')
      .map((l) => l.replace(/#.*/, '').trim())
      .filter(Boolean)
      .map((l) => l.split(/\s+/));
    const own = lines.find(([file]) => file === MIGRATION_NAME);
    expect(own?.[1]).toBe('2026-11-10');
    expect(new Set(lines.map((l) => l[2])).size).toBe(1);
  });

  it('die drei Assertions stehen in der SQL-Datei, in PRIVILEGE_ASSERTION_NAMES und in pending_assertions_for', () => {
    const mapping = drift.match(new RegExp(`    ${MIGRATION_NAME.replace(/\./g, '\\.')}\\)\\n\\s+echo "([^"]+)"`));
    expect(mapping?.[1].split(' ').sort()).toEqual([...A34_ASSERTIONS].sort());
    for (const name of A34_ASSERTIONS) {
      expect(assertions).toContain(`SELECT '${name}',`);
      expect(drift).toContain(`  "${name}"`);
    }
  });
});

describe('A-34 Prüfskript und Matrix', () => {
  /** Beschriftungen `check K "<label>"` des Prüfskripts. */
  const rows = [...check.matchAll(/check [KR] "([^"]+)"/g)].map((m) => m[1]);

  it.each(['@FU-026', '@FU-027', '@FU-028', '@FU-030', '@HE-049', '@SL-015', '@SL-046', '@SL-116', '@FU-081', '@SL-018'])(
    '%s: mindestens eine Zeile im Prüfskript',
    (kennung) => {
      expect(rows.some((r) => r.includes(kennung)), kennung).toBe(true);
    },
  );

  it.each(['@FU-026', '@FU-027', '@FU-028', '@HE-049', '@SL-015', '@SL-116', '@FU-080'])('%s: mindestens ein Gegenbeispiel', (kennung) => {
    expect(rows.some((r) => r.includes(kennung) && r.includes('Gegenbeispiel')), kennung).toBe(true);
  });

  it('die Matrix-Datei läuft nach spur-geraete-a27.sh (Glob-Reihenfolge, beide Sortierungen)', () => {
    const files = readdirSync(resolve(ROOT, 'scripts/rls-matrix.d')).filter((n) => n.endsWith('.sh'));
    const ohneSatzzeichen = (n: string) => n.replace(/[^a-z0-9]/g, '');
    const byte = [...files].sort();
    const locale = [...files].sort((x, y) => (ohneSatzzeichen(x) < ohneSatzzeichen(y) ? -1 : 1));
    for (const order of [byte, locale]) {
      expect(order.indexOf('spur-steuer-a34.sh')).toBeGreaterThan(order.indexOf('spur-geraete-a27.sh'));
    }
  });
});
