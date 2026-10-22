/**
 * Spiel beenden (20261110_009, Variante A mit Review-Auflagen M1–M4): Zwillinge Migration ↔ TS und Basis der ersetzten
 * Funktionen. Den Szenario-Beweis gegen echtes Postgres führen scripts/spiel-beenden-check.sh und
 * scripts/match-engine-parity.sh (Fixtures 40, 70a–70k); dieser Wächter hält fest:
 *  - jede ersetzte Funktion baut auf der Fassung aus 20261110_005 auf und weicht nur um die dokumentierten Zeilen ab,
 *  - die neuen Übergänge stehen gleich in matchTransitions.json und in der Migration, nie aus 'shootout' (@FU-118),
 *  - die c3-Ausnahme gilt genau für die angepfiffenen Zustände ohne 'shootout' und steht VOR dem c3-Block (Review M3),
 *  - Rechte-Assertion, Drift-Check-Zuordnung, PENDING-LIVE und Dateiname (nach _008, vor 20261113_003) passen.
 * Anforderungen: @FU-081, @FU-112, @FU-113, @FU-114, @FU-115, @FU-116, @FU-118, @FU-119.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import matchTransitions from '../../core/match/matchTransitions.json';
import { MatchStatusSchema } from '../../core/match/types';
import { functionBlock, latestBefore, lineDiff, readMigration } from './migrationFunctionDiff';

const ROOT = resolve(__dirname, '../../..');
const MIGRATION_NAME = '20261110_009_spiel_beenden.sql';
const BASE_NAME = '20261110_005_result_entry_forfeit.sql';
/** SHA-256 von 20261110_005 (unverändert, Auftrag: _005 bis _008 und _101 nicht ändern). */
const BASE_SHA256 = '889b13348822eb8f6d88630a06a1abd1f1a56b4271559f8e25e8ecd5ffe75a11';
const migration = readMigration(MIGRATION_NAME);
const drift = readFileSync(resolve(ROOT, 'scripts/db-drift-check.sh'), 'utf8');
const assertions = readFileSync(resolve(ROOT, 'scripts/db_privilege_assertions.sql'), 'utf8');
const pending = readFileSync(resolve(ROOT, 'supabase/migrations/PENDING-LIVE.txt'), 'utf8');
const ASSERTION = 'append-match-events-end-by-lead-without-claim';

const EXPECTED_DIFFS: ReadonlyArray<{ fn: string; removed: readonly string[]; added: readonly string[] }> = [
  {
    fn: 'match_engine.payload_valid',
    removed: [],
    added: [
      '-- Spiel beenden (20261110_009, @FU-116, Review M4): optional der Stand, den die Turnierleitung kannte (string|null',
      '-- wie CORRECTION, payloadValidation.ts) -- Pflicht und geprueft nur aus einem angepfiffenen Zustand (apply_effect).',
      "IF v_payload ? 'basedOn' AND NOT coalesce(jsonb_typeof(v_payload -> 'basedOn') IN ('string', 'null'), false) THEN",
      'RETURN false;',
      'END IF;',
    ],
  },
  {
    fn: 'match_engine.apply_result_entry',
    removed: [],
    added: [
      "-- Spiel beenden (20261110_009, Review M2): Uhr anhalten, eine offene Pause ist zu (fuer 'scheduled' wirkungsgleich,",
      '-- stop_clock laesst eine stehende Uhr unveraendert; handlers/correction.ts applyResultEntry).',
      "'clock', match_engine.stop_clock(p_state -> 'clock', p_event),",
      "'breakStartedAt', NULL,",
    ],
  },
  {
    fn: 'match_engine.apply_effect',
    removed: [],
    added: [
      '-- Spiel beenden (20261110_009, @FU-112/@FU-114): aus einem angepfiffenen Zustand (Uebergaenge nur fuer die Leitung)',
      "-- gilt zusaetzlich (handlers/correction.ts applyResultEntry): Review M1 (@FU-119) eine Wertung nur aus 'scheduled';",
      '-- Review M4 (@FU-116) basedOn ist Pflicht und muss dem letzten Spielstand-Eintrag entsprechen (wie CORRECTION).',
      "IF p_state ->> 'status' <> 'scheduled' THEN",
      "IF (p_event -> 'payload') ? 'forfeit' THEN",
      'RETURN match_engine.reject(\'INVALID_TRANSITION\', \'{"reason": "FORFEIT_NOT_SCHEDULED"}\'::jsonb);',
      'END IF;',
      "IF (p_event -> 'payload' -> 'basedOn') IS DISTINCT FROM coalesce(p_state -> 'lastScoreEventId', 'null'::jsonb) THEN",
      "RETURN match_engine.reject('STALE_BASE', match_engine.stale_base_detail(p_state, p_ctx));",
      'END IF;',
      'END IF;',
    ],
  },
  {
    fn: 'public.append_match_events',
    removed: [
      "IF v_state ->> 'status' = ANY (c_live_states)",
      "OR (v_event ->> 'type' IN ('MATCH_START', 'REOPEN') AND NOT v_forfeit_reopen) THEN",
    ],
    added: [
      '-- Spiel beenden (20261110_009, Review M3): Ergebnis der Turnierleitung in ein angepfiffenes Spiel -- ohne Feldsteuerung.',
      'v_end_by_lead boolean;',
      '-- Spiel beenden (20261110_009, @FU-112, @FU-115, Review M3): die Turnierleitung beendet ein angepfiffenes Spiel mit',
      '-- ihrem Ergebnis auch, wenn ein anderes Geraet das Feld steuert -- VOR dem ganzen c3-Block: keine Ablehnung, kein',
      '-- Anspruch auf ein freies Feld, keine Epochen-Pruefung (der Halter bleibt). Nicht im Strafstossschiessen (@FU-118:',
      '-- dort gilt c3, die Rechenfunktion lehnt ohnehin ab); Helfer pruefen c3 und die Rechenfunktion (@FU-113).',
      "v_end_by_lead := coalesce(v_actor = 'leitung' AND v_event ->> 'type' = 'RESULT_ENTRY'",
      "AND v_state ->> 'status' IN ('running', 'paused', 'section_break', 'decision_pending'), false);",
      'IF NOT v_end_by_lead',
      "AND (v_state ->> 'status' = ANY (c_live_states)",
      "OR (v_event ->> 'type' IN ('MATCH_START', 'REOPEN') AND NOT v_forfeit_reopen)) THEN",
    ],
  },
];

describe('Spiel beenden: Basis der ersetzten Funktionen (Review-Risiko 1)', () => {
  it('die Migration ersetzt genau diese vier Funktionen', () => {
    const replaced = [...migration.matchAll(/^CREATE OR REPLACE FUNCTION (\S+)\(/gm)].map((m) => m[1]).sort();
    expect(replaced).toEqual(EXPECTED_DIFFS.map((d) => d.fn).sort());
  });

  it.each(EXPECTED_DIFFS.map((d) => ({ name: d.fn, expected: d })))('$name baut auf 20261110_005 auf und weicht nur um die dokumentierten Zeilen ab', ({ expected }) => {
    expect(latestBefore(MIGRATION_NAME, expected.fn)).toBe(BASE_NAME);
    const actual = lineDiff(functionBlock(readMigration(BASE_NAME), expected.fn), functionBlock(migration, expected.fn));
    expect(actual.removed).toEqual(expected.removed);
    expect(actual.added).toEqual(expected.added);
  });

  it('20261110_005 ist unverändert (SHA-256)', () => {
    expect(createHash('sha256').update(readMigration(BASE_NAME)).digest('hex')).toBe(BASE_SHA256);
  });

  it('Dateiname sortiert nach 20261110_008 und vor dem Turnier-Abschluss 20261113_003', () => {
    expect(MIGRATION_NAME > '20261110_008').toBe(true);
    expect(MIGRATION_NAME < '20261110_101').toBe(true);
    expect(MIGRATION_NAME < '20261113_003').toBe(true);
  });

  it('Fail-fast prüft die Fassungen aus 20261110_005 (Wertung, Feldsteuerung)', () => {
    const failFast = migration.slice(migration.indexOf('DO $$'), migration.indexOf('END;\n$$;'));
    for (const marker of ['v_forfeit_reopen', 'public.field_control', "'''forfeit'''", 'reopensBeforeStart', "v_payload ? ''forfeit''",
      'match_engine.stale_base_detail(jsonb,jsonb)', 'match_engine.stop_clock(jsonb,jsonb)']) {
      expect(failFast, marker).toContain(marker);
    }
    expect(failFast).toContain("RAISE EXCEPTION '20261110_009_spiel_beenden: Vorgaenger fehlen");
  });
});

describe('Spiel beenden: Zwillinge Migration ↔ TS', () => {
  const ENDABLE = ['running', 'paused', 'section_break', 'decision_pending'];

  it('@FU-112 @FU-114 @FU-118 RESULT_ENTRY der Leitung aus genau vier angepfiffenen Zuständen, nie aus shootout – JSON = Migration', () => {
    const fromJson = matchTransitions.transitions
      .filter((row) => row.type === 'RESULT_ENTRY' && row.from !== 'scheduled')
      .map((row) => `${row.from}|${row.actor}|${row.to}`)
      .sort();
    expect(fromJson).toEqual(ENDABLE.map((from) => `${from}|leitung|finished`).sort());
    const fromSql = [...migration.matchAll(/\('([a-z_]+)', 'RESULT_ENTRY', '([a-z]+)', '([a-z]+)'\)/g)].map((m) => `${m[1]}|${m[2]}|${m[3]}`).sort();
    expect(fromSql).toEqual(fromJson);
    expect(migration).toContain('ON CONFLICT ("from_status", "event_type") DO NOTHING;');
  });

  it('Review M3: die c3-Ausnahme gilt für die angepfiffenen, nicht beendeten Zustände außer shootout', () => {
    const m = migration.match(/v_state ->> 'status' IN \(([^)]+)\), false\);/);
    const states = [...(m?.[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
    const notLive = new Set(['scheduled', 'finished', 'skipped', 'shootout']);
    expect(states).toEqual(MatchStatusSchema.options.filter((s) => !notLive.has(s)).sort());
    const body = functionBlock(migration, 'public.append_match_events').join('\n');
    expect(body.indexOf('IF NOT v_end_by_lead')).toBeLessThan(body.indexOf('v_claim_pending := p_device_id IS NOT NULL'));
    expect(body).toContain("v_actor = 'leitung' AND v_event ->> 'type' = 'RESULT_ENTRY'");
  });
});

describe('Spiel beenden: Drift-Check (Rechte-Assertion, PENDING-LIVE)', () => {
  it('die Assertion steht in der SQL-Datei, in PRIVILEGE_ASSERTION_NAMES und in pending_assertions_for', () => {
    const mapping = drift.match(new RegExp(`    ${MIGRATION_NAME.replace(/\./g, '\\.')}\\)\\n\\s+echo "([^"]+)"`));
    expect(mapping?.[1]).toBe(ASSERTION);
    expect(assertions).toContain(`SELECT '${ASSERTION}',`);
    expect(drift).toContain(`  "${ASSERTION}"`);
  });

  it('PENDING-LIVE: Zeile <datei> <frist> <commit-vorher> bis zum Fenster G1b (spätestens 10.11.)', () => {
    const row = pending
      .split('\n')
      .map((l) => l.replace(/#.*/, '').trim())
      .filter(Boolean)
      .map((l) => l.split(/\s+/))
      .find(([file]) => file === MIGRATION_NAME);
    expect(row?.[1]).toBe('2026-11-10');
    expect(row?.[2]).toMatch(/^[0-9a-f]{40}$/);
  });
});
