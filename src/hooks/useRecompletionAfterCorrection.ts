/**
 * A-15b (R2 PR 2): Auslöser des erneuten Abschlusses nach einer Korrektur (@TM-071, @TM-150 Zeile 2, @TM-145, @TM-099, @EK-017).
 *
 * Hat der Server eine Korrektur in einer abgeschlossenen Gruppe angenommen, markiert er die Gruppe als veraltet (`stale`); das
 * Gerät erfährt es über den nächsten frischen Stand (eigene Korrektur bestätigt, Realtime oder Abfrage). Dann schließt das Gerät
 * der Turnierleitung die Gruppe einmal erneut ab (`complete_group` mit `openRanks`), ohne Zutun – nicht angepfiffene Folgespiele
 * werden neu besetzt, ein Gleichstand auf einem auszuspielenden Platz ohne Folgespiel bleibt als „Besetzung prüfen“ stehen.
 *
 * - Nur mit dem Recht `manageLifecycle` und mit Netz; ohne Turnierleitungs-Gerät bleibt `stale`, der Hinweis erscheint beim
 *   nächsten Öffnen (RT-9). Ohne Netz kein Aufruf (die Korrektur ist erst nach der Bestätigung am Server veraltet).
 * - Mehrere Geräte der Turnierleitung: gleiche Aufrufe ergeben `ALREADY_COMPLETED`/`STALE_VERSION` – neu lesen, keine Meldung.
 * - Je Gruppe und Stand höchstens ein Versuch (kein Endlosversuch bei einer Ablehnung); ein neuer Stand darf erneut.
 * - Eine Entscheidung im Kasten der Tabelle schließt die Gruppe selbst ab (@W2A-074); dieser Auslöser ruft dafür nichts zusätzlich.
 */
import { useEffect, useRef } from 'react';
import type { Tournament } from '../types/tournament';
import type { CompleteGroupRequest, CompleteGroupResult } from '../core/repositories/groupCompletionCloud';
import { groupsToRecomplete, reassignAfterCorrection } from '../core/services/followUps';

export interface RecompletionDeps {
  /** `complete_group` des Repositories (fehlt es, passiert nichts). */
  completeGroup?: (tournamentId: string, request: CompleteGroupRequest) => Promise<CompleteGroupResult>;
  /** Turnierleitung oder Co-Admin (`manageLifecycle`). */
  canManage: boolean;
  online: boolean;
  /** Lokaler Speicher (Gast): veraltet ist eine Gruppe dort, wenn die Rangfolge nicht mehr passt. */
  local: boolean;
  /** Nach einem Aufruf frisch laden (Abschluss, besetzte Folgespiele, `stale` weg). */
  onDone: () => void;
}

/** Stand einer Anfrage: dieselbe Gruppe mit derselben Rangfolge, denselben offenen Plätzen und denselben Spielständen. */
const keyOf = (tournamentId: string, request: CompleteGroupRequest): string =>
  JSON.stringify([tournamentId, request.groupId, request.ranking, request.openRanks, request.expectedState, request.tieDecisions.map((d) => d.id)]);

export function useRecompletionAfterCorrection(tournament: Tournament | null, deps: RecompletionDeps): void {
  const { completeGroup, canManage, online, local, onDone } = deps;
  const tried = useRef(new Set<string>());
  const running = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (tournament === null || !canManage || !online || completeGroup === undefined || running.current) {
      return;
    }
    const pending = groupsToRecomplete(tournament, { local })
      .map((groupId) => reassignAfterCorrection(tournament, groupId))
      .filter((request): request is CompleteGroupRequest => request !== null && !tried.current.has(keyOf(tournament.id, request)));
    if (pending.length === 0) {
      return;
    }
    running.current = true;
    void (async () => {
      try {
        for (const request of pending) {
          tried.current.add(keyOf(tournament.id, request));
          // Ablehnungen (schon abgeschlossen, Stand geändert) zeigen nichts: der frische Stand entscheidet beim nächsten Lauf
          await completeGroup(tournament.id, request).catch(() => undefined);
        }
      } finally {
        running.current = false;
        onDoneRef.current();
      }
    })();
  }, [tournament, canManage, online, local, completeGroup]);
}
