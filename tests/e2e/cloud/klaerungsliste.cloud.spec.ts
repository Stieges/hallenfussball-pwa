/**
 * tests/e2e/cloud/klaerungsliste.cloud.spec.ts — Ende-zu-Ende-Nachweis der Klärungsliste (B-50 Oberfläche auf A-35 Server,
 * Migration 20261117_005; @FU-038, @FU-095, @FU-096, @FU-130, @FU-017, @HE-056, @FU-037).
 *
 * Absichtlich `fixme`: Der Ablauf braucht im lokalen Supabase-Stack die Migrationen bis 20261117_005 (A-34 Feldsteuerung
 * 20261110_003, G1/G1b, A-35). Geprüft am 23.10. (nur lesend): `list_match_reviews` und `take_field_control` fehlen dort.
 * Der Auftrag verbietet, den lokalen Stack zu starten, zu stoppen, zurückzusetzen oder zu säen. Einschalten nach dem Fenster
 * F4 (17.11.) bzw. beim nächsten Stack-Neuaufbau. Bis dahin belegen den Weg: scripts/klaerungsliste-check.sh (Server, 80/80),
 * die Vitest-Dateien unter src/core/match/review/__tests__ und src/features/klaerungsliste/__tests__.
 *
 * Ablauf (zwei Geräte; Olli Desktop, Tom Handy 360 × 640):
 *  1. Tom steuert Feld 2, Spiel 9 läuft. Toms Gerät geht offline (context.setOffline), Olli „Spielleitung übernehmen“.
 *  2. Tom trägt offline ein Tor FC Nord, ein Tor SV Süd und Gelb SV Süd Nr. 5 ein, dann wieder online.
 *  3. Tom: `outbox-notice` zeigt „wird geprüft (3)“ (@FU-038). Spielstand bei Olli unverändert.
 *  4. Olli: `klaerungsliste-knopf` mit Zähler 3 → Dialog (`?klaerung=1`) „3 Einträge von Tom nach Übernahme“.
 *     Aufklappen, beide Tore abwählen, „Übernehmen“ → Vorschau „Neuer Stand: FC Nord 0:0 SV Süd“, „Übernommen: Gelbe Karte
 *     SV Süd, Nr. 5“ → „Speichern“ → Zähler weg, Verlauf: Gelb zählt, Tore verworfen (@FU-095).
 *  5. 360 px: Dialog ohne waagrechten Überlauf (`document.documentElement.scrollWidth <= innerWidth`), jede Taste ≥ 44 px.
 *  6. @HE-056: Olli entfernt Tom (change_helper_access 'revoke'), Tom offline Tor, online → Toms Cockpit
 *     `cockpit-zugriff-entzogen` „Du hast keinen Zugriff mehr – 1 Eintrag an die Turnierleitung übergeben“; Olli sieht
 *     „1 Eintrag von Tom, Recht entzogen“.
 */
import { test } from './fixtures';

test.fixme('@FU-038 @FU-095 Toms Offline-Einträge nach der Übernahme: „wird geprüft“, Olli übernimmt nur die Gelbe Karte', async () => {
  // Wartet auf 20261117_005 (und A-34/G1b) im lokalen Stack (siehe Kopf).
});

test.fixme('@FU-095 T2-UI: Klärungsliste bei 360 px ohne Überlauf, Tasten mindestens 44 px', async () => {
  // Wartet auf 20261117_005 im lokalen Stack (siehe Kopf).
});

test.fixme('@HE-056 @FU-017 Recht entzogen: Toms Gerät „an die Turnierleitung übergeben“, Olli „von Tom, Recht entzogen“', async () => {
  // Wartet auf 20261117_005 und 20261110_008 im lokalen Stack (siehe Kopf).
});
