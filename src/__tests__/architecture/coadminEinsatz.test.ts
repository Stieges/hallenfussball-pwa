/**
 * CA-2 (plan-coadmin-einsatzfaehig.md § CA-2, review-plan-coadmin.md Auflagen 2-5): Wächter für
 * `supabase/migrations/20261110_004_coadmin_einsatz.sql` – Co-Admin teilt online (NEU-CA3) und liest die Lebenszeichen
 * der Monitore (NEU-CA5), @HE-085. Der Beleg läuft gegen echtes Postgres (scripts/rls-matrix.d/coadmin.sh,
 * scripts/coadmin-einsatz-check.sh); dieser Test hält fest, dass Migration, Matrix, Assertions und Drift-Check
 * zusammenpassen. Er ersetzt die Container-Läufe nicht.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../..');
const read = (path: string): string => readFileSync(resolve(ROOT, path), 'utf8');

const migration = read('supabase/migrations/20261110_004_coadmin_einsatz.sql');
const assertions = read('scripts/db_privilege_assertions.sql');
const drift = read('scripts/db-drift-check.sh');
const pending = read('supabase/migrations/PENDING-LIVE.txt');
const matrix = read('scripts/rls-role-matrix.sh');
const matrixPart = read('scripts/rls-matrix.d/coadmin.sh');
const check = read('scripts/coadmin-einsatz-check.sh');

const NAMES = ['share-rpcs-permission-based', 'make-public-keeps-existing-code', 'heartbeats-select-manage-screens'];
const RPCS = ['make_tournament_public', 'make_tournament_private', 'regenerate_share_code'];

/** Rumpf einer Funktion der Migration (von CREATE OR REPLACE bis zum schließenden $$;). */
function body(name: string): string {
  const start = migration.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  expect(start, name).toBeGreaterThan(-1);
  return migration.slice(start, migration.indexOf('\n$$;', start));
}

describe('CA-2 Migration 20261110_004_coadmin_einsatz.sql', () => {
  it.each(RPCS)('%s: Recht tournamentSettings statt Eigentümer, Fehlertext und SECURITY DEFINER unverändert', (name) => {
    const fn = body(name);
    expect(fn).toContain("IF NOT public.has_tournament_permission(tournament_id, 'tournamentSettings') THEN");
    expect(fn).toContain("RAISE EXCEPTION 'Not authorized to modify this tournament';");
    expect(fn).toContain('SECURITY DEFINER');
    expect(fn).toContain("SET search_path TO 'public', 'pg_temp'");
    expect(fn).not.toContain('owner_id');
  });

  it('make_tournament_public: Freigabe-Sperre HF001 bleibt, vorhandener Code kommt zurück (Auflage 5)', () => {
    const fn = body('make_tournament_public');
    expect(fn).toContain("USING ERRCODE = 'HF001'");
    expect(fn).toContain('FOR UPDATE;');
    expect(fn).toContain('IF v_is_public AND v_existing_code IS NOT NULL THEN');
    // Reihenfolge: Rechte → HF001 → Code bleibt → Neuwürfeln
    const order = ['has_tournament_permission', "'HF001'", 'v_existing_code IS NOT NULL', 'generate_share_code()'].map((s) => fn.indexOf(s));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('Lebenszeichen: beide Policies per DROP IF EXISTS, neue nur für authenticated über manageScreens (Auflage 3)', () => {
    expect(migration).toContain('DROP POLICY IF EXISTS owner_select_heartbeats ON public.monitor_heartbeats;');
    expect(migration).toContain('DROP POLICY IF EXISTS heartbeats_select_v2 ON public.monitor_heartbeats;');
    expect(migration).toMatch(
      /CREATE POLICY heartbeats_select_v2 ON public\.monitor_heartbeats\n {2}FOR SELECT TO authenticated\n {2}USING \(public\.has_tournament_permission\(tournament_id, 'manageScreens'\)\);/,
    );
  });

  it('Fail-fast verlangt _001 (manageScreens) und _002 (is_real_account), nicht _003 (Auflage 2)', () => {
    expect(migration).toContain("to_regprocedure('public.is_real_account()') IS NULL");
    expect(migration).toContain("WHERE role = 'co-admin' AND permission = 'manageScreens'");
    expect(migration).not.toMatch(/field_control/);
    expect(migration).toMatch(/^BEGIN;\nSET LOCAL lock_timeout = '5s';$/m);
    expect(migration.trimEnd().endsWith('COMMIT;')).toBe(true);
  });
});

describe('CA-2 Drift-Check und Rechte-Assertions', () => {
  it.each(NAMES)('%s steht in der SQL-Datei, in PRIVILEGE_ASSERTION_NAMES und in pending_assertions_for', (name) => {
    expect(assertions).toContain(`SELECT '${name}',`);
    expect(drift).toContain(`  "${name}"`);
    const mapping = drift.slice(drift.indexOf('    20261110_004_coadmin_einsatz.sql)'));
    expect(mapping.slice(0, mapping.indexOf(';;'))).toContain(name);
  });

  it('keine PENDING-LIVE-Zeile: der Code mit DB-Abhängigkeit wird erst nach dem Einspielen gemergt (Daniel 20.10.)', () => {
    expect(pending).not.toContain('20261110_004');
  });

  it.each(['field-control-check.sh', 'guard-all-matches-check.sh', 'match-kit-check.sh', 'event-author-names-check.sh'])(
    '%s nimmt die CA-2-Zeilen aus "keine Zeile |f" aus (die Migration läuft dort erst später)',
    (file) => {
      const script = read(`scripts/${file}`);
      for (const name of NAMES) {
        expect(script, `${file}: ${name}`).toContain(name);
      }
    },
  );
});

describe('CA-2 Rechte-Matrix und Container-Beweis', () => {
  it('die Matrix spielt _004 ein und kennt die Gegenprobe --without-coadmin (auch im CI-Gate)', () => {
    expect(matrix).toContain('CA2_FILE="$(find_migration 20261110_004)"');
    expect(matrix).toContain('--without-coadmin)');
    expect(matrix).toContain('"$WITH_CA2_REQ" -eq 1 && "$MISMATCHES" -gt 0');
  });

  it('coadmin.sh: alle Identitäten (inkl. Geräte, anonyme Sitzungen, anon) × drei RPCs und Lesen, mit Gegenbeispielen', () => {
    expect(matrixPart).toContain('for ca2_id in "${MATRIX_IDS[@]}" anon-coadmin; do');
    for (const label of [
      'NEU-CA3 make_tournament_public $ca2_id',
      'NEU-CA3 make_tournament_private $ca2_id',
      'NEU-CA3 regenerate_share_code $ca2_id',
      'NEU-CA5 monitor_heartbeats lesen (eigenes Turnier) $ca2_id',
      'NEU-CA5 gegen-nachbarturnier',
      'anon (ohne Sitzung)',
      'gegen-entwurf',
      'erneut-teilen',
      'gegen-erneut-teilen',
      'Bestand regenerate_share_code',
    ]) {
      expect(matrixPart, label).toContain(label);
    }
    // Erwartung aus rolePermissions.json, nicht aus dem Code
    expect(matrixPart).toContain('perm_expected "$(role_for_id "$ca2_id")" tournamentSettings');
    expect(matrixPart).toContain('perm_expected "$(role_for_id "$ca2_id")" manageScreens');
  });

  it('Container-Beweis: Fenster-Reihenfolge, Wegwerf-Container mit trap, Rückweg aus der Baseline', () => {
    expect(check).toContain('WINDOW_NAMES=(20261110_001_role_permissions_mvp.sql 20261110_002_device_roles.sql 20261110_003_field_control.sql)');
    expect(check).toContain('--platform "$DOCKER_PLATFORM"');
    expect(check).toContain('trap cleanup EXIT');
    expect(check).toContain('--print-rueckweg');
    for (const rpc of RPCS) {
      expect(check).toContain(rpc);
    }
    expect(check).toContain('CREATE POLICY \\"owner_select_heartbeats\\"');
  });
});
