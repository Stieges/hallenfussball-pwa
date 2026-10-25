/**
 * Welche Turniere diese App gerade als abgeschlossen kennt (R3-3, @LZ-036, @LZ-037; Plan R3 V6): ein kleines Verzeichnis
 * ohne React, damit `useCan` („die EINE Frage nach einem Recht“) nach dem Abschluss alle schreibenden Rechte verneinen
 * kann, ohne dass jeder der 22 Aufrufer das Turnier mitbekommt. Geschrieben wird es dort, wo ein Turnier geladen wird
 * (`useLifecycleLock` in `useTournamentManager`, `useTournaments`); gelesen von `useCan`. Der Zustand selbst kommt vom Server
 * (R3-1) und wird nie aus Spielständen abgeleitet (@LZ-006).
 */
const closed = new Set<string>();
const listeners = new Set<() => void>();
/** Stand-Nummer für `useSyncExternalStore`: ändert sich nur, wenn sich wirklich etwas ändert. */
let version = 0;

/** Merkt, ob das Turnier abgeschlossen (oder abgebrochen) ist. Ohne Änderung kein Aufruf der Beobachter. */
export function setTournamentClosed(tournamentId: string, isClosed: boolean): void {
  if (closed.has(tournamentId) === isClosed) {
    return;
  }
  if (isClosed) {
    closed.add(tournamentId);
  } else {
    closed.delete(tournamentId);
  }
  version += 1;
  listeners.forEach((listener) => { listener(); });
}

export function isTournamentClosedById(tournamentId: string): boolean {
  return closed.has(tournamentId);
}

export function subscribeClosedTournaments(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function closedTournamentsVersion(): number {
  return version;
}

/** Nur für Tests: Verzeichnis leeren. */
export function resetClosedTournaments(): void {
  if (closed.size === 0) {
    return;
  }
  closed.clear();
  version += 1;
  listeners.forEach((listener) => { listener(); });
}
