/**
 * A-25b Nichtantritt (task-GA4-plan-v2.md „A-25b“, Anhang B.1, Review-Auflage 4): Zwillinge Migration ↔ TS und Basis der
 * ersetzten Funktionen. Den Szenario-Beweis gegen echtes Postgres führen scripts/forfeit-check.sh (Kategorien N/P/R/A),
 * scripts/match-engine-parity.sh (Fixtures 69a–69n) und scripts/append-match-events-check.sh; dieser Wächter hält fest:
 *  - jede in 20261110_005 ersetzte Funktion baut auf genau der JÜNGSTEN Vorfassung auf und weicht nur um die
 *    dokumentierten Zeilen ab (append_match_events aus 20261110_003 A-34 – nie aus einer 20261028-Fassung, sonst wäre die
 *    Steuer je Feld live zurückgedreht),
 *  - REOPEN zeigt in matchTransitions.json und in der Migration auf '@reopen',
 *  - die Schutzspalte forfeit_absent und die Rechte-Assertions passen zusammen; seit dem Einspielen (23.10.) steht die
 *    Migration nicht mehr in PENDING-LIVE.
 * Anforderungen: @W2A-022, @W2A-024, @W2A-026, @TM-063, @TM-004.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import matchTransitions from '../../core/match/matchTransitions.json';
import { SERVER_ONLY_MATCH_COLUMNS } from '../../core/repositories/serverOnlyMatchColumns';

const ROOT = resolve(__dirname, '../../..');
const MIGRATIONS = resolve(ROOT, 'supabase/migrations');
const MIGRATION_NAME = '20261110_005_result_entry_forfeit.sql';
const read = (name: string) => readFileSync(resolve(MIGRATIONS, name), 'utf8');
const migration = read(MIGRATION_NAME);
const drift = readFileSync(resolve(ROOT, 'scripts/db-drift-check.sh'), 'utf8');
const assertions = readFileSync(resolve(ROOT, 'scripts/db_privilege_assertions.sql'), 'utf8');
const pending = readFileSync(resolve(ROOT, 'supabase/migrations/PENDING-LIVE.txt'), 'utf8');

interface FunctionDiff {
  fn: string;
  base: string;
  removed: readonly string[];
  added: readonly string[];
}

/** Funktionsblock wörtlich: ab „CREATE OR REPLACE FUNCTION <fn>(“ bis zur Zeile „$$;“. */
function block(text: string, fn: string): string[] {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.startsWith(`CREATE OR REPLACE FUNCTION ${fn}(`));
  expect(start, `${fn} fehlt`).toBeGreaterThanOrEqual(0);
  const end = lines.findIndex((line, i) => i > start && line === '$$;');
  return lines.slice(start, end + 1);
}

/** Zeilen-Diff über die längste gemeinsame Teilfolge: entfernte und hinzugefügte Zeilen (getrimmt, in Reihenfolge). */
function lineDiff(before: string[], after: string[]): { removed: string[]; added: string[] } {
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

const EXPECTED_DIFFS: readonly FunctionDiff[] = [
  {
    fn: "match_engine.payload_valid",
    base: "20261028_003_result_entry_shootout.sql",
    removed: [],
    added: [
      "-- A-25n (@W2A-022, @W2A-024): optional die Nichtantritt-Wertung -- genau der Schluessel `absent` (A|B|both),",
      "-- `both` nur 0:0, `A` fehlt -> B gewinnt, `B` fehlt -> A gewinnt, nie zusammen mit `shootout`",
      "-- (payloadValidation.ts ForfeitSchema/forfeitScoresValid). Ein explizites null ist ungueltig (zod optional).",
      "IF v_payload ? 'forfeit'",
      "AND NOT coalesce(jsonb_typeof(v_payload -> 'forfeit') = 'object'",
      "AND (SELECT count(*) FROM jsonb_object_keys(v_payload -> 'forfeit')) = 1",
      "AND NOT (v_payload ? 'shootout')",
      "AND CASE v_payload -> 'forfeit' ->> 'absent'",
      "WHEN 'both' THEN (v_payload -> 'scores' ->> (p_ctx ->> 'teamAId'))::numeric = 0",
      "AND (v_payload -> 'scores' ->> (p_ctx ->> 'teamBId'))::numeric = 0",
      "WHEN 'A' THEN (v_payload -> 'scores' ->> (p_ctx ->> 'teamBId'))::numeric",
      "> (v_payload -> 'scores' ->> (p_ctx ->> 'teamAId'))::numeric",
      "WHEN 'B' THEN (v_payload -> 'scores' ->> (p_ctx ->> 'teamAId'))::numeric",
      "> (v_payload -> 'scores' ->> (p_ctx ->> 'teamBId'))::numeric",
      "ELSE false",
      "END, false) THEN",
      "RETURN false;",
      "END IF;",
    ],
  },
  {
    fn: "match_engine.apply_result_entry",
    base: "20261028_003_result_entry_shootout.sql",
    removed: [
      "'kind', 'direct',",
      "THEN jsonb_build_object('shootout', p_event -> 'payload' -> 'shootout') ELSE '{}'::jsonb END),",
    ],
    added: [
      "-- A-25n (@W2A-022): mit `forfeit` eine Nichtantritt-Wertung (handlers/correction.ts applyResultEntry).",
      "'kind', CASE WHEN (p_event -> 'payload') ? 'forfeit' THEN 'forfeit' ELSE 'direct' END,",
      "THEN jsonb_build_object('shootout', p_event -> 'payload' -> 'shootout') ELSE '{}'::jsonb END",
      "-- A-25n: wer fehlte, nur bei einer Wertung (sonst kein Schluessel, wie TS).",
      "|| CASE WHEN (p_event -> 'payload') ? 'forfeit'",
      "THEN jsonb_build_object('absent', p_event -> 'payload' -> 'forfeit' -> 'absent') ELSE '{}'::jsonb END),",
    ],
  },
  {
    fn: "match_engine.decided_by",
    base: "20260928_002_match_engine.sql",
    removed: [],
    added: [
      "-- A-25n (@W2A-022): Nichtantritt-Wertung (types.ts decidedByFor).",
      "WHEN p_state -> 'overrides' -> -1 ->> 'kind' = 'forfeit' THEN '\"forfeit\"'::jsonb",
    ],
  },
  {
    fn: "match_engine.apply_effect",
    base: "20261028_001_transitions_za3.sql",
    // Review A-25 M1 (@SL-074/@SL-075): „Spiel fortsetzen“ einmal je Anpfiff (undo.reopensBeforeStart, reopen.ts).
    removed: [
      "IF EXISTS (SELECT 1 FROM jsonb_each(coalesce(p_state -> 'accepted', '{}'::jsonb)) AS a(k, v)",
      "WHERE a.v ->> 'type' = 'REOPEN') THEN",
    ],
    added: [
      "-- A-25n (Review M1, @SL-074/@SL-075): \"Spiel fortsetzen\" ebenso je Anpfiff -- REOPEN davor zaehlen nicht.",
      "'reopensBeforeStart', (SELECT count(*) FROM jsonb_each(coalesce(p_state -> 'accepted', '{}'::jsonb)) AS a(k, v)",
      "WHERE a.v ->> 'type' = 'REOPEN'),",
      "-- A-25n (Review M1): einmal je Anpfiff -- nur ein REOPEN nach dem letzten Anpfiff zaehlt (undo.reopensBeforeStart);",
      "-- die Ruecknahme einer Wertung davor verbraucht das Fortsetzen nicht (handlers/reopen.ts acceptedReopenCount).",
      "IF (SELECT count(*) FROM jsonb_each(coalesce(p_state -> 'accepted', '{}'::jsonb)) AS a(k, v)",
      "WHERE a.v ->> 'type' = 'REOPEN') > coalesce(match_engine.num(v_undo -> 'reopensBeforeStart'), 0) THEN",
      "-- A-25n (@W2A-026, R-GA4-4): ist die letzte Ueberschreibung eine Nichtantritt-Wertung, nimmt REOPEN sie",
      "-- zurueck -- Spiel wieder 'scheduled', Wertung vom Stapel, Uhr unveraendert (eine Wertung entsteht nur aus",
      "-- 'scheduled'), lastScoreEventId = REOPEN (handlers/reopen.ts). Helfer scheitern vorher (kein baseDecidedBy).",
      "-- Den Zielzustand setzt die Wirkung selbst: Uebergangszeile finished -> '@reopen' (match_apply_event).",
      "IF coalesce(p_state -> 'overrides', '[]'::jsonb) -> -1 ->> 'kind' = 'forfeit' THEN",
      "RETURN match_engine.ok(p_state || jsonb_build_object(",
      "'status', 'scheduled',",
      "'overrides', (p_state -> 'overrides') - (-1),",
      "'finishedAt', NULL,",
      "'baseDecidedBy', NULL,",
      "'breakStartedAt', NULL,",
      "'lastScoreEventId', p_event -> 'id'));",
      "END IF;",
      "'status', 'running',",
    ],
  },
  {
    fn: "public.match_apply_event",
    base: "20261001_001_amend_event.sql",
    removed: [
      "-- 5. Typspezifische Wirkung, dann `to`.",
      "ELSIF v_row ->> 'to' <> '=' THEN",
    ],
    added: [
      "-- 5. Typspezifische Wirkung, dann `to` (A-25n: '@reopen' = Zielzustand aus der Wirkung).",
      "ELSIF v_row ->> 'to' NOT IN ('=', '@reopen') THEN",
      "-- A-25n: bei '@reopen' hat die Wirkung (apply_effect REOPEN) den Zielzustand schon gesetzt (applyEvent.ts).",
    ],
  },
  {
    fn: "match_engine.cache_columns",
    base: "20261028_007_entered_shootout_needs_draw.sql",
    removed: [
      "'skipped_reason', CASE WHEN v_status = 'skipped' THEN p_state ->> 'skipReason' END);",
    ],
    added: [
      "'skipped_reason', CASE WHEN v_status = 'skipped' THEN p_state ->> 'skipReason' END,",
      "-- A-25n (@W2A-022, @W2A-024): wer nicht angetreten ist -- nur im beendeten Spiel, solange die Wertung die letzte",
      "-- Ueberschreibung ist (cacheColumns.ts forfeitAbsent). decided_by 'forfeit' faellt oben in den ELSE-Zweig.",
      "'forfeit_absent', CASE WHEN v_status = 'finished' AND v_last_override ->> 'kind' = 'forfeit'",
      "THEN v_last_override -> 'absent' END);",
    ],
  },
  {
    fn: "public.append_match_events",
    base: "20261110_003_field_control.sql",
    removed: [
      "IF v_state ->> 'status' = ANY (c_live_states) OR v_event ->> 'type' IN ('MATCH_START', 'REOPEN') THEN",
      "WHEN v_knockout AND NOT ((v_event -> 'payload') ? 'shootout')",
    ],
    added: [
      "-- A-25n (R-A25b-1): REOPEN, das eine Nichtantritt-Wertung zuruecknimmt (Spiel wird wieder 'scheduled', nicht laufend).",
      "v_forfeit_reopen boolean;",
      "-- A-25n (R-A25b-1, @W2A-026): das Zuruecknehmen einer Wertung startet kein Spiel (Ziel 'scheduled') -- es",
      "-- braucht keine Steuer, wie Direkteintrag und Korrektur an nicht laufenden Spielen (Auflage Bauplan § 20).",
      "v_forfeit_reopen := coalesce(v_event ->> 'type' = 'REOPEN' AND v_state ->> 'status' = 'finished'",
      "AND v_state -> 'overrides' -> -1 ->> 'kind' = 'forfeit', false);",
      "IF v_state ->> 'status' = ANY (c_live_states)",
      "OR (v_event ->> 'type' IN ('MATCH_START', 'REOPEN') AND NOT v_forfeit_reopen) THEN",
      "-- A-25n (R-A25b-2): eine Nichtantritt-Wertung braucht kein Strafstossergebnis (beide fehlen im K.-o.: 0:0).",
      "WHEN v_knockout AND NOT ((v_event -> 'payload') ? 'shootout') AND NOT ((v_event -> 'payload') ? 'forfeit')",
      "-- A-25n (@W2A-022): wer nicht angetreten ist (nur Wertung im beendeten Spiel, sonst NULL).",
      "forfeit_absent = v_cache ->> 'forfeit_absent',",
    ],
  },
  {
    fn: "public.matches_guard_engine_columns",
    base: "20261028_005_guard_all_matches.sql",
    removed: [
      "OR NEW.skipped_reason IS DISTINCT FROM OLD.skipped_reason THEN",
    ],
    added: [
      "NEW.forfeit_absent := NULL;",
      "OR NEW.skipped_reason IS DISTINCT FROM OLD.skipped_reason",
      "OR NEW.forfeit_absent IS DISTINCT FROM OLD.forfeit_absent THEN",
    ],
  },
];

/** Die jüngste Migration VOR 20261110_005, die eine Funktion definiert (Dateinamen sortiert wie beim Einspielen). */
function latestBefore(fn: string): string {
  const names = readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith('.sql') && name < MIGRATION_NAME && !name.startsWith('00000000000000'))
    .sort();
  return names.filter((name) => read(name).includes(`CREATE OR REPLACE FUNCTION ${fn}(`)).at(-1) ?? '';
}

describe('A-25b Basis der ersetzten Funktionen (Review-Auflage 4)', () => {
  it('die Migration ersetzt genau diese acht Funktionen', () => {
    const replaced = [...migration.matchAll(/^CREATE OR REPLACE FUNCTION (\S+)\(/gm)].map((m) => m[1]).sort();
    expect(replaced).toEqual(EXPECTED_DIFFS.map((d) => d.fn).sort());
  });

  it.each(EXPECTED_DIFFS.map((d) => ({ name: d.fn, expected: d })))('$name baut auf der jüngsten Vorfassung auf und weicht nur um die dokumentierten Zeilen ab', ({ expected }) => {
    expect(latestBefore(expected.fn)).toBe(expected.base);
    const actual = lineDiff(block(read(expected.base), expected.fn), block(migration, expected.fn));
    expect(actual.removed).toEqual(expected.removed);
    expect(actual.added).toEqual(expected.added);
  });

  it('append_match_events kommt aus 20261110_003 (A-34) und behält die Steuer je Feld', () => {
    expect(latestBefore('public.append_match_events')).toBe('20261110_003_field_control.sql');
    const body = block(migration, 'public.append_match_events').join('\n');
    expect(body).toContain('public.field_control');
    expect(body).toContain("'code', 'NOT_CONTROLLER'");
    expect(body).toContain('p_device_id uuid DEFAULT NULL');
  });

  it('Fail-fast prüft die Vorfassungen (A-34, SW, ZA-3, A-25a, A-10, C0b)', () => {
    const failFast = migration.slice(migration.indexOf('DO $$'), migration.indexOf('END;\n$$;'));
    for (const marker of ['public.field_control', 'effective_score(p_state, v_a) = match_engine.effective_score(p_state, v_b)',
      'c_continue_window_ms', "v_payload ? ''shootout''", 'details_from_payload', "TG_OP = ''INSERT''"]) {
      expect(failFast, marker).toContain(marker);
    }
    expect(failFast).toContain("RAISE EXCEPTION '20261110_005_result_entry_forfeit: Vorgaenger fehlen");
  });
});

describe('A-25b Zwillinge Migration ↔ TS', () => {
  it('@W2A-026 REOPEN zeigt in matchTransitions.json und in der Migration auf „@reopen“ (R-GA4-4)', () => {
    const reopen = matchTransitions.transitions.filter((row) => row.type === 'REOPEN');
    expect(reopen).toEqual([{ from: 'finished', type: 'REOPEN', actor: 'helper', to: '@reopen' }]);
    expect(migration).toMatch(/UPDATE public\.match_transitions SET to_status = '@reopen'\s+WHERE from_status = 'finished' AND event_type = 'REOPEN'/);
    expect(migration).toContain("'finished', 'skipped', '=', '@endcheck', '@reopen'));");
  });

  it('@W2A-022 forfeit_absent ist Schutzspalte in TS und im Spalten-Schutz der Migration (A|B|both)', () => {
    expect(SERVER_ONLY_MATCH_COLUMNS).toContain('forfeit_absent');
    expect(migration).toContain("CHECK (forfeit_absent IS NULL OR forfeit_absent IN ('A', 'B', 'both'))");
    expect(migration).toContain("CHECK (decided_by IN ('regular', 'overtime', 'goldenGoal', 'penalty', 'forfeit'))");
  });

  it('@TM-004 der CHECK final_type kennt die Spiele um Platz 5 und 7', () => {
    expect(migration).toContain(
      "CHECK (final_type IS NULL OR final_type IN ('quarterfinal', 'semifinal', 'thirdPlace', 'fifthSixth', 'seventhEighth', 'final'))",
    );
  });
});

describe('A-25b Drift-Check (Rechte-Assertions, PENDING-LIVE)', () => {
  const NAMES = ['matches-guard-engine-columns-forfeit-absent', 'append-match-events-writes-forfeit-absent'];

  it('die zwei Assertions stehen in der SQL-Datei, in PRIVILEGE_ASSERTION_NAMES und in pending_assertions_for', () => {
    const escaped = MIGRATION_NAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const mapping = drift.match(new RegExp(`    ${escaped}\\)\\n\\s+echo "([^"]+)"`));
    expect(mapping?.[1].split(' ').sort()).toEqual([...NAMES].sort());
    for (const name of NAMES) {
      expect(assertions).toContain(`SELECT '${name}',`);
      expect(drift).toContain(`  "${name}"`);
    }
  });

  it('keine PENDING-LIVE-Zeile: 20261110_005 ist live (vorgezogenes Fenster 23.10.) – sonst ließe der Drift-Check die Assertions aus', () => {
    const files = pending
      .split('\n')
      .map((l) => l.replace(/#.*/, '').trim())
      .filter(Boolean)
      .map((l) => l.split(/\s+/)[0]);
    expect(files).not.toContain(MIGRATION_NAME);
  });
});
