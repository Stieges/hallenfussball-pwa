/**
 * A-10 Zwillinge TS ↔ SQL (brief-A-10.md § 4, Wächter `src/__tests__/architecture/serverOnlyMatchColumns.test.ts`).
 *
 * Z1 `SERVER_ONLY_MATCH_COLUMNS`: die 17 Spalten, die `matches_guard_engine_columns` (jüngste Fassung
 *    `supabase/migrations/20261110_005_result_entry_forfeit.sql`, vorher 20261028_005) für Client-Rollen bei JEDEM Spiel
 *    sperrt (@EK-060). Kein Client-Schreibweg sendet sie für bestehende Spiele.
 * Z3 `NEUTRAL_RESULT_COLUMNS`: Neutralwerte, mit denen der Server ein neues Spiel anlegt (INSERT-Zweig des Schutzes)
 *    und `reset_match_results` ein Spiel zurücksetzt – dieselben Werte schreibt `mapMatchToSupabase`. Ausnahme
 *    `ENGINE_EVENT_ONLY_MATCH_COLUMNS`: entsteht nur durch ein Engine-Ereignis, `reset_match_results` fasst solche Spiele nie an
 *    (HAS_ENTRIES), setzt die Spalte deshalb auch nicht.
 * Ändert sich eine Seite, schlägt der Wächter an.
 */
export const SERVER_ONLY_MATCH_COLUMNS = [
  'score_a', 'score_b',
  'overtime_score_a', 'overtime_score_b',
  'penalty_score_a', 'penalty_score_b',
  'match_status', 'decided_by',
  'timer_start_time', 'timer_paused_at', 'timer_elapsed_seconds',
  'live_state', 'actual_start', 'actual_end',
  'skipped_at', 'skipped_reason',
  // A-25n/A-25b (20261110_005, @W2A-022): wer nicht angetreten ist.
  'forfeit_absent',
] as const;

export type ServerOnlyMatchColumn = typeof SERVER_ONLY_MATCH_COLUMNS[number];

/**
 * A-25b: Schutzspalten, die nur ein Engine-Ereignis setzt (Nichtantritt-Wertung = RESULT_ENTRY). `reset_match_results`
 * setzt nur Spiele OHNE Engine-Ereignisse zurück und schreibt sie deshalb nicht (Wächter Z3).
 */
export const ENGINE_EVENT_ONLY_MATCH_COLUMNS: readonly ServerOnlyMatchColumn[] = ['forfeit_absent'];

/** Nur zwei Spalten sind nicht leer: Status „geplant“ und Uhr 0 (wie `mapMatchToSupabase`); alle übrigen NULL. */
const NON_NULL_NEUTRAL: Partial<Record<ServerOnlyMatchColumn, string | number>> = { match_status: 'scheduled', timer_elapsed_seconds: 0 };

export const NEUTRAL_RESULT_COLUMNS = Object.fromEntries(
  SERVER_ONLY_MATCH_COLUMNS.map((column) => [column, NON_NULL_NEUTRAL[column] ?? null]),
) as Readonly<Record<ServerOnlyMatchColumn, string | number | null>>;
