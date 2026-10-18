/**
 * useMatchEntryGuard (A-08f3e4 Punkt 2): „Hat ein Spiel Einträge?“ für die Sperren von Zurücksetzen und Neu erzeugen
 * (@FU-090) und für Wiederherstellen aus der Sicherung (@FU-091). Gilt, bis „Spielplan auf Anfang setzen“ (@SA-001) bzw.
 * „Ergebnis löschen“ (A-30/B-36) den Weg übernehmen.
 *
 * Quelle: Server-Revision > 1 (`serverLedMatchIds`, Registry des Turnier-Repositorys) ∪ lokale Engine-Kopie des Kontos
 * mit Einträgen (bestätigt, angenommen oder wartend; der Gast hat dieselbe Kopie im Gastkonto, `hasGuestEngineEntries`).
 * Ein Turnier ohne Spiele hat keine Einträge (nichts zu lesen). Fehlerpolitik: Quelle nicht lesbar oder keine Spiel-Engine
 * → gilt als „hat Einträge“ (sperren, sichere Richtung) + Sentry. Der Hinweis erscheint als Toast.
 */
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Match } from '../types/tournament';
import type { MatchCopy } from '../core/match/client';
import { matchesWithEntries } from '../core/services/matchResultStatusDiff';
import { captureFeatureError } from '../lib/sentry';
import { useOptionalToast } from '../components/ui/Toast/ToastContext';
import { useMatchEngineContextOptional } from '../features/match-engine/useMatchEngineContext';
import { useServerRevisionSource } from './useServerLedMatchIds';

/** Turnier oder Formular-Stand des Assistenten (dort sind `id`/`matches` optional). */
export interface EntryGuardTournament {
  id?: string;
  matches?: Match[];
}

export interface MatchEntryReading {
  /** Spiele mit Einträgen; bei `unreadable` alle Spiele. */
  matches: Match[];
  unreadable: boolean;
}

export interface MatchEntryGuard {
  read: (tournament: EntryGuardTournament) => Promise<MatchEntryReading>;
  /** @FU-090: hat ein Spiel Einträge → Hinweis „Spiel 7 hat Einträge – …“ und `true` (nicht ausführen). */
  blocks: (tournament: EntryGuardTournament) => Promise<boolean>;
  notify: (text: string) => void;
  isGuest: boolean;
}

const hasEntries = (copy: MatchCopy): boolean => copy.confirmed.length + copy.acked.length + copy.pending.length > 0;

export function useMatchEntryGuard(): MatchEntryGuard {
  const { t } = useTranslation('tournament');
  const context = useMatchEngineContextOptional();
  const revisions = useServerRevisionSource();
  const toast = useOptionalToast();

  const read = useCallback(async (tournament: EntryGuardTournament): Promise<MatchEntryReading> => {
    const matches = tournament.matches ?? [];
    if (matches.length === 0) {
      return { matches: [], unreadable: false };
    }
    try {
      if (!context) {
        throw new Error('Spiel-Engine nicht verfügbar');
      }
      const ids = new Set((await context.store.forAccount(context.accountId)).filter(hasEntries).map((copy) => copy.matchId));
      revisions?.serverLedMatchIds(tournament.id ?? '').forEach((matchId) => ids.add(matchId));
      return { matches: matchesWithEntries({ matches }, ids), unreadable: false };
    } catch (error) {
      captureFeatureError(error instanceof Error ? error : new Error(String(error)), 'schedule', 'matchEntryGuard', { tournamentId: tournament.id });
      return { matches, unreadable: true };
    }
  }, [context, revisions]);

  const notify = useCallback((text: string) => { toast?.showWarning(text); }, [toast]);

  const blocks = useCallback(async (tournament: EntryGuardTournament): Promise<boolean> => {
    const { matches, unreadable } = await read(tournament);
    if (matches.length === 0) {
      return false;
    }
    // F-b: das erste betroffene Spiel in Spielplan-Reihenfolge; ohne Spielnummer die Stelle im Spielplan (wie der Generator)
    const first = matches[0];
    const number = first.matchNumber ?? (tournament.matches ?? []).indexOf(first) + 1;
    notify(unreadable ? t('schedule.entriesGuard.unreadable') : t('schedule.entriesGuard.blocked', { number }));
    return true;
  }, [read, notify, t]);

  return useMemo(() => ({ read, blocks, notify, isGuest: context?.accountId === 'guest' }), [read, blocks, notify, context]);
}
