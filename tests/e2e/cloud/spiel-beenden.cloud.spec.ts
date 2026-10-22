/**
 * tests/e2e/cloud/spiel-beenden.cloud.spec.ts — Ende-zu-Ende-Nachweis „Spiel beenden und Ergebnis eintragen“ im Spielplan
 * (20261110_009, @FU-112, @FU-115, @FU-113; Zuschauer-Teil @FU-112/@FU-114).
 *
 * Als Spec angelegt, absichtlich `fixme`: der Ablauf braucht die Migrationen 20261110_005 und 20261110_009 im lokalen
 * Supabase-Stack. Beide stehen in PENDING-LIVE und sind dort noch nicht eingespielt; der Auftrag verbietet, den lokalen
 * Stack anzufassen (kein Reset, kein Einspielen). Einschalten, sobald der Stack beide Migrationen hat (nach dem Fenster G1b
 * bzw. beim nächsten Stack-Neuaufbau). Bis dahin belegen den Weg: scripts/spiel-beenden-check.sh (Server, echte RPC),
 * scripts/match-engine-parity.sh (Fixtures 40, 70a–70k) und die Vitest-Dateien useScheduleResultEntry.spielBeenden.test.tsx,
 * ScheduleEndPrompt.test.tsx, toScoreboardModel.spielplanEnde.test.ts, spielBeenden.view.test.ts.
 *
 * Ablauf (zwei Geräte, Desktop):
 *  1. Helfer Tom pfeift im Live-Cup Spiel 9 auf Feld 2 im Cockpit an (Toms Gerät steuert Feld 2).
 *  2. Olli (Eigentümer) trägt im Spielplan 3:1 für Spiel 9 ein → Rückfrage „Spiel beenden und Ergebnis eintragen“ mit
 *     „Feld 2 wird gerade von Tom gesteuert“ und „Spiel 9 läuft noch – Uhr zeigt … Restzeit. Jetzt mit 3:1 beenden?“.
 *  3. „Nein“ → Spiel 9 läuft weiter (DB: match_status running). „Ja“ → DB: finished, 3:1, timer_start_time NULL.
 *  4. Toms Cockpit zeigt „Ende – eingetragen im Spielplan von Olli“; die Zuschauerseite zeigt „Ende“ mit 3:1.
 *  5. Gegenbeispiel @FU-113: Tom trägt im Spielplan für das nächste laufende Spiel ein → „Spiel läuft – Ergebnis erst nach
 *     dem Abpfiff“, keine Rückfrage.
 */
import { test } from './fixtures';

test.fixme('@FU-112 @FU-115 Olli beendet Toms laufendes Spiel 9 im Spielplan ohne Übernahme; Tom und Zuschauer sehen „Ende“', async () => {
  // Wartet auf 20261110_005 + 20261110_009 im lokalen Stack (siehe Kopf).
});

test.fixme('@FU-113 Helfer Tom bekommt im Spielplan „Spiel beenden“ nicht angeboten', async () => {
  // Wartet auf 20261110_005 + 20261110_009 im lokalen Stack (siehe Kopf).
});
