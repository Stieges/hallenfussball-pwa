/**
 * tests/e2e/cloud/nichtantritt.cloud.spec.ts -- B-12 (Regel T2-UI): Nichtantritt in der Oberfläche gegen den lokalen Stack.
 * Szenarien: @W2A-022 (gewertet 2:0 für den Gegner), @W2A-023 (abgereist), @W2A-026 (zurücknehmen), @SL-174 (derselbe Dialog
 * im Spielplan und unter „Mehr“), @SL-175 / @FU-119 / @SL-118 (Gegenbeispiele: nach Anpfiff, Helfer).
 *
 * Bewusst `test.fixme`: Der Lauf braucht ein Wegwerf-Turnier mit geplanten Spielen und die Migration `20261110_005` im lokalen
 * Stack. Dieses Paket startet, stoppt und säht den Stack nicht (Auftrag B-12). Verhalten ist bis dahin durch die Verhaltenstests
 * `ScheduleTab.nichtantritt.test.tsx`, `LiveCockpit.nichtAngetreten.test.tsx` und `MatchCommands.b12Nichtantritt.test.ts`
 * belegt. Einschalten, sobald ein Seed mit einem geplanten Gruppenspiel (Owner und Helfer) vorhanden ist.
 */
import { test } from './fixtures';

test.describe('B-12 Nichtantritt gegen den lokalen Stack', () => {
  test.fixme('@W2A-022 @SL-174 Owner wertet im Spielplan „<Heim> nicht angetreten“: DB-Zeile decided_by forfeit, forfeit_absent A', async () => {
    // Spielplan → Spielkarte → „Nicht angetreten“ → <Heim> → „Wertung eintragen“ → matches-Zeile prüfen.
  });

  test.fixme('@W2A-026 Owner nimmt die Wertung zurück: Spiel wieder scheduled, forfeit_absent leer', async () => {
    // Spielkarte → „Wertung zurücknehmen“ → Rückfrage bestätigen.
  });

  test.fixme('@SL-175 @SL-118 Helfer sieht unter „Mehr“ und im Spielplan kein „Nicht angetreten“; nach dem Anpfiff auch der Owner nicht', async () => {
    // asRole('helper') bzw. angepfiffenes Spiel.
  });
});
