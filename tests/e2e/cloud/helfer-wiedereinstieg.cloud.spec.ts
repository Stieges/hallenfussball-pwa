/**
 * tests/e2e/cloud/helfer-wiedereinstieg.cloud.spec.ts — GA5 A-17c „Wiedereinstieg, Zugangsstatus, Offline bereit“.
 *
 * Szenarien: @HE-001 (Warteschirm → „Du bist zugelassen“ ohne neuen Scan), @HE-096 (Tab schließen → Adresse der App → Feld 2),
 * @HE-098 (entzogen → „Du hast keinen Zugriff mehr“), @HE-099 (zwei Turniere → Auswahl), @HE-028 (Offline bereit, Offline-Start),
 * @HE-055 (Entzug binnen 3 s), Gegenbeispiel: entzogen → kein Eintrag.
 *
 * `fixme` mit Grund: Der Block braucht den lokalen Stack MIT der Migration `20261110_008_helper_join.sql`, gesäte Testkonten und
 * einen Zugang, der erst hier entsteht; dieser Lauf startet, stoppt und sät den Stack nicht (Auftrag A-17c). Der Aufbau folgt
 * `helfer-beitritt.cloud.spec.ts`. Die Logik ist in Vitest je Szenario mit Gegenbeispiel und Mutationsprobe belegt
 * (features/helpers/__tests__, screens/__tests__/JoinScreen.zulassung.test.tsx). Offen bleibt der Nachweis am echten Gerät
 * (Flugmodus, Startbildschirm-App auf iPhone/iPad = Gerätetest F2).
 */
import { test } from './fixtures';

test.describe('Helfer-Wiedereinstieg (A-17c)', () => {
  test.fixme(true, 'Stack-Lauf nicht Teil von A-17c-1: braucht _008 + gesäte Konten (nicht starten/säen). Aufbau wie helfer-beitritt.cloud.spec.ts.');

  test('@HE-001 @HE-097 Warteschirm wechselt nach der Zulassung von allein auf „Du bist zugelassen“ mit Hinweis', async () => {
    // 1. Helfer-Kontext: /join/<code>, Name „Tom“, Anfrage senden → Prüfzahl; 2. Leitung (REST) lässt mit Prüfzahl und Feld 2 zu;
    // 3. innerhalb von 3 s: helper-approved sichtbar, home-hint sichtbar, kein neuer Scan.
  });

  test('@HE-096 @HE-098 Tab schließen → Adresse der App → Feld 2 ohne Eingabe; nach Entzug „Du hast keinen Zugriff mehr“', async () => {
    // newPage im selben Kontext (gleicher localStorage): goto('/#/') → URL …/live?f=2; Leitung entzieht → goto('/#/') → join-end-state.
  });

  test('@HE-099 Zugänge zu zwei Turnieren → Auswahl; eins abgeschlossen → direkt', async () => {
    // Zweites Wegwerf-Turnier anlegen und beitreten; goto('/#/') → helper-chooser; Abschluss REST → goto('/#/') → Feld des anderen.
  });

  test('@HE-028 Zulassung am Vorabend: „Offline bereit“, danach ohne Netz Spielplan Feld 2 und Anpfiff', async () => {
    // offline-ready sichtbar; context.setOffline(true); goto('/#/') → …/live?f=2; Spiel anpfeifen.
  });
});
