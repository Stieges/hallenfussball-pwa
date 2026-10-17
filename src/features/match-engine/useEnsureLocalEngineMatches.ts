/**
 * useEnsureLocalEngineMatches (A-08f3e3): beim Laden eines Turniers die lokalen Engine-Kopien mit Einträgen
 * laden (`ensureMatch`), damit ein Spielplan-Eintrag nach dem Neuladen sichtbar bleibt (@FU-002, @FU-004).
 * Gast: jede Kopie mit Einträgen (lokal `confirmed`). Konto: nur Kopien mit wartenden (`pending`) oder
 * nicht übernommenen (`rejected`) Einträgen -- alles andere liefert der Server. Ohne Kopie kein `ensureMatch`.
 * Dieselbe Liste nutzt A-31.
 */
import { useEffect, useMemo, useRef } from 'react';
import type { Tournament } from '../../types/tournament';
import type { MatchCopy } from '../../core/match/client';
import type { MatchEngineContextValue } from './matchEngineContextInstance';
import { buildValidMatches } from '../../hooks/engineMatchModel';

export function needsLocalCopy(copy: MatchCopy, isGuest: boolean): boolean {
  if (isGuest) {
    return copy.confirmed.length + copy.acked.length + copy.pending.length > 0;
  }
  return copy.pending.length > 0 || copy.rejected.length > 0;
}

export function useEnsureLocalEngineMatches(tournament: Tournament | null, context: MatchEngineContextValue | null): void {
  const tournamentRef = useRef(tournament);
  tournamentRef.current = tournament;
  // Nur neu laufen, wenn sich Turnier oder Spielmenge ändern -- nicht bei jeder Überlagerung.
  const matchKey = useMemo(
    () => (tournament ? `${tournament.id}|${buildValidMatches(tournament).map((entry) => entry.matchId).join(',')}` : ''),
    [tournament],
  );

  useEffect(() => {
    const current = tournamentRef.current;
    if (!current || !context || matchKey === '') {
      return;
    }
    const { engine, store, accountId } = context;
    void (async () => {
      const copies = await store.forAccount(accountId);
      const wanted = new Set(copies.filter((copy) => needsLocalCopy(copy, accountId === 'guest')).map((copy) => copy.matchId));
      for (const entry of buildValidMatches(current)) {
        if (wanted.has(entry.matchId) && !engine.view(entry.matchId)) {
          await engine.ensureMatch(entry.matchId, entry.ctx, current.id);
        }
      }
    })().catch(() => undefined);
  }, [matchKey, context]);
}
