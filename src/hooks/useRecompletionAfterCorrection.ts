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
 * - Mehrere Geräte der Turnierleitung: ohne offene Plätze ergibt ein zweiter Aufruf `ALREADY_COMPLETED`/`STALE_VERSION`; bleiben
 *   offene Plätze (die Gruppe bleibt veraltet), trägt der geltende Abschluss schon dieselbe Rangfolge – dann gibt es gar keine
 *   Anfrage (`reassignAfterCorrection`, Review #384 M1), auch nach neuem Öffnen nicht.
 * - Je Gruppe und Stand höchstens ein Versuch (kein Endlosversuch bei einer Ablehnung); ein neuer Stand darf erneut. Endete der
 *   Versuch mit einem Fehler statt mit einer Antwort, gilt er nach der Rückkehr des Netzes als nicht versucht (N1).
 * - Scheitert ein Versuch, zeigt die Tabelle „Besetzung prüfen“ wieder (`recompletionFailures`, M3); solange der Auslöser die
 *   Gruppe gleich erledigt, bleibt der Hinweis aus (@TM-150 Zeile 2).
 * - Bekannte Grenze (Befund C-AUTO-ABSCHLUSS-EINGEREIHT): kippt das Netz zwischen der Prüfung hier und dem Aufruf, reiht
 *   `OfflineRepository` den Abschluss ein; eine Abweichung beim Nachreichen erschiene dann in der Klärungsliste.
 * - Eine Entscheidung im Kasten der Tabelle schließt die Gruppe selbst ab (@W2A-074); dieser Auslöser ruft dafür nichts zusätzlich.
 */
import { useEffect, useRef } from 'react';
import type { Tournament } from '../types/tournament';
import type { CompleteGroupRequest, CompleteGroupResult } from '../core/repositories/groupCompletionCloud';
import { groupsToRecomplete, reassignAfterCorrection, recompletionKey } from '../core/services/followUps';
import { clearRecompletionFailed, markRecompletionFailed } from './recompletionFailures';

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

export function useRecompletionAfterCorrection(tournament: Tournament | null, deps: RecompletionDeps): void {
  const { completeGroup, canManage, online, local, onDone } = deps;
  const tried = useRef(new Set<string>());
  /** Review #384 N1: Versuche, die mit einem Fehler (nicht mit einer Antwort des Servers) endeten – nach der Rückkehr des Netzes erneut. */
  const thrown = useRef(new Set<string>());
  const running = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (online) {
      thrown.current.forEach((key) => { tried.current.delete(key); });
      thrown.current.clear();
    }
  }, [online]);

  useEffect(() => {
    if (tournament === null || !canManage || !online || completeGroup === undefined || running.current) {
      return;
    }
    const pending = groupsToRecomplete(tournament, { local })
      .map((groupId) => reassignAfterCorrection(tournament, groupId))
      .filter((request): request is CompleteGroupRequest => request !== null && !tried.current.has(recompletionKey(tournament.id, request)));
    if (pending.length === 0) {
      return;
    }
    running.current = true;
    void (async () => {
      try {
        for (const request of pending) {
          const key = recompletionKey(tournament.id, request);
          tried.current.add(key);
          try {
            const result = await completeGroup(tournament.id, request);
            // Schon abgeschlossen (zweites Leitungsgerät) gilt als erledigt; eine Ablehnung zeigt „Besetzung prüfen“ wieder (M3)
            if (result.status === 'ok') {
              clearRecompletionFailed(key);
            } else {
              markRecompletionFailed(key);
            }
          } catch {
            thrown.current.add(key); // N1: nach der Rückkehr des Netzes erneut versuchen
            markRecompletionFailed(key);
          }
        }
      } finally {
        running.current = false;
        onDoneRef.current();
      }
    })();
  }, [tournament, canManage, online, local, completeGroup]);
}
