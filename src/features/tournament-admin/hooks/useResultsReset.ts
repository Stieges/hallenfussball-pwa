/**
 * useResultsReset (A-10 Teil D, brief-A-10.md § 3): „Ergebnisse zurücksetzen“ (Einstellungen, Gefahrenbereich) und
 * „Turnier zurücksetzen“ (Assistent Schritt 2).
 *
 * - Sperre @FU-090 (Bestand `useMatchEntryGuard`): hat ein Spiel Einträge → Hinweis, nichts geändert.
 * - Gast (oder ohne Cloud): lokal wie bisher.
 * - Konto-Turnier: nur mit Verbindung (L8); erst der Server (`reset_match_results` mit ALLEN Spielen, nur Turnierleitung,
 *   alles oder nichts), danach lokal. `HAS_ENTRIES` → Text @FU-090 mit dem ersten betroffenen Spiel; `42501` →
 *   „nur Turnierleitung“; sonst „gerade nicht möglich“ + Meldung. In keinem dieser Fälle ändert sich lokal etwas.
 *   Kein Eintrag in der Warteschlange: die Ergebnis-Spalten schreibt seit A-10 nur der Server.
 * Rückgabe: die zurückgesetzten Spiele (der Aufrufer übernimmt sie lokal) oder `null` (nichts geändert).
 * Anforderungen: @FU-090, @HE-042 (`plattform/2026-09-24_fundament-gemeinsamer-stand.md`, `2026-09-24_helfer-am-turniertag.md`).
 */
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Match } from '../../../types/tournament';
import { useMatchEntryGuard, type EntryGuardTournament } from '../../../hooks/useMatchEntryGuard';
import { callResetMatchResults } from '../../../core/repositories/resetMatchResultsRpc';
import { SERVER_LED_MATCH_FIELDS } from '../../../core/repositories/serverLedMatchFields';
import { isSupabaseConfigured, supabase } from '../../../lib/supabase';
import { captureFeatureError } from '../../../lib/sentry';

/**
 * Lokales Zurücksetzen eines Spiels – dieselben Felder, die der Server neutral setzt (Zwilling Z3): alle server-geführten
 * Felder (`SERVER_LED_MATCH_FIELDS`: Spielstand, Verlängerung, Strafstoß, Entscheidung, Ende, Absetzen) leer, Status
 * „geplant“, Uhr leer; dazu der lokale Korrekturverlauf.
 */
export function resetResultFields(match: Match): Match {
  const cleared = Object.fromEntries(SERVER_LED_MATCH_FIELDS.map((field) => [field, undefined])) as Partial<Match>;
  return {
    ...match,
    ...cleared,
    matchStatus: 'scheduled',
    timerStartTime: undefined,
    timerPausedAt: undefined,
    timerElapsedSeconds: undefined,
    correctionHistory: undefined,
  };
}

export interface ResultsReset {
  /** @FU-090 Vorab-Prüfung (Hinweis, wenn ein Spiel Einträge hat). */
  blocks: (tournament: EntryGuardTournament) => Promise<boolean>;
  /** Setzt alle Spiele zurück; `null` = nichts geändert (Hinweis ist bereits gezeigt). */
  reset: (tournament: EntryGuardTournament) => Promise<Match[] | null>;
}

export function useResultsReset(): ResultsReset {
  const { t } = useTranslation('tournament');
  const entryGuard = useMatchEntryGuard();

  const reset = useCallback(async (tournament: EntryGuardTournament): Promise<Match[] | null> => {
    const matches = tournament.matches ?? [];
    if (matches.length === 0 || await entryGuard.blocks(tournament)) {
      return null;
    }
    const local = matches.map(resetResultFields);
    if (entryGuard.isGuest || !isSupabaseConfigured || !tournament.id) {
      return local;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      entryGuard.notify(t('schedule.entriesGuard.resetOffline'));
      return null;
    }
    try {
      const result = await callResetMatchResults(supabase, tournament.id, matches.map((m) => m.id));
      if (result.status === 'ok') {
        return local;
      }
      if (result.status === 'forbidden') {
        entryGuard.notify(t('schedule.resultEntry.leadOnly'));
        return null;
      }
      // F-b wie useMatchEntryGuard: erstes betroffenes Spiel in Spielplan-Reihenfolge, ohne Nummer die Stelle im Spielplan.
      const index = matches.findIndex((m) => result.matchIds.includes(m.id));
      const number = matches[index]?.matchNumber ?? index + 1;
      entryGuard.notify(t('schedule.entriesGuard.blocked', { number }));
      return null;
    } catch (error) {
      captureFeatureError(error instanceof Error ? error : new Error(String(error)), 'schedule', 'resetMatchResults', { tournamentId: tournament.id });
      entryGuard.notify(t('schedule.entriesGuard.resetFailed'));
      return null;
    }
  }, [entryGuard, t]);

  return useMemo(() => ({ blocks: entryGuard.blocks, reset }), [entryGuard.blocks, reset]);
}
