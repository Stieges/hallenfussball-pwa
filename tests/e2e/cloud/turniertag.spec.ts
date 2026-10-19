/**
 * tests/e2e/cloud/turniertag.spec.ts — der Durchstich (A-23, Plan § 8): EIN Ablauf über den
 * Turniertag, Schritte D0a-D18 als Module unter `turniertag/steps/` (eine Datei je Besitzer-
 * Aufgabe, keine Hotspot-Datei). Läuft NUR gegen den lokalen Stack (`scripts/require-local-stack.sh`,
 * Aufruf `npm run test:e2e:cloud -- tests/e2e/cloud/turniertag.spec.ts`) und nur auf `cloud-desktop`.
 *
 * Schritte, deren Besitzer-Aufgabe noch nicht gebaut ist, sind `test.fail` ("Besitzer: <Aufgabe>"
 * steht im Titel der Beschreibung und im Modul). Wird einer unerwartet grün, meldet Playwright
 * "Expected to fail, but passed": das Signal, dass der Besitzer fertig ist und der Schritt auf
 * `expectedFail: false` gehört. Die Schritte laufen nacheinander auf demselben, frisch geseedeten
 * Turniertag-Cup; ohne neuen Seed (`npm run test:env:seed`) ist der Cup verbraucht.
 */
import { test } from './fixtures';
import { steps as d00 } from './turniertag/steps/d00-vorbereitung';
import { steps as d01, stepsNachGruppenabschluss as d01Monitor } from './turniertag/steps/d01-anlegen';
import { steps as d02 } from './turniertag/steps/d02-cloud-stand';
import { steps as direktaufruf } from './turniertag/steps/direktaufruf';
import { steps as d03 } from './turniertag/steps/d03-helfer-qr';
import { steps as d03b } from './turniertag/steps/d03b-helfer-feld';
import { steps as d04 } from './turniertag/steps/d04-anpfiff-tor-karte';
import { steps as d04b } from './turniertag/steps/d04b-uebernahme';
import { steps as d05 } from './turniertag/steps/d05-offline-tor';
import { steps as d05b, stepsNachHalbzeit as d06b } from './turniertag/steps/d05b-netz-und-eingabe';
import { steps as d06 } from './turniertag/steps/d06-halbzeit-zeitstrafe';
import { steps as d07 } from './turniertag/steps/d07-zuschauer-live';
import { steps as d07b } from './turniertag/steps/d07b-tv-gekoppelt';
import { steps as d08 } from './turniertag/steps/d08-gruppenabschluss-hf';
import { steps as d08b, stepsEndstand as d10b, stepsAbsetzen as d10c } from './turniertag/steps/d08b-ablauf-regeln';
import { steps as d09 } from './turniertag/steps/d09-hf-elfmeter';
import { steps as d10 } from './turniertag/steps/d10-finale-nichtantritt';
import { steps as d11 } from './turniertag/steps/d11-abschluss-sperre';
import { steps as d11b, stepsNachZeitplan as d13Folgen, stepsEnde as d18 } from './turniertag/steps/d11b-abschluss-folgen';
import { steps as d12 } from './turniertag/steps/d12-korrektur';
import { steps as d13 } from './turniertag/steps/d13-zeitplan-verschieben';
import { steps as d14 } from './turniertag/steps/d14-pdf-sicherung';
import { steps as d15 } from './turniertag/steps/d15-zweites-turnier';
import type { TurniertagStep } from './turniertag/steps/types';

export const TURNIERTAG_STEPS: readonly TurniertagStep[] = [
  // Reihenfolge entlang des Turnierablaufs (Plan "Turnier durchspielbar" (b); Fixrunde 1, A3):
  //  - Vorbereitung: D0a-D0e und D16 (Spielplan auf Anfang, auf der Kopie fürs Proben) VOR dem Turniertag.
  //  - Turniertag vor dem Gruppenabschluss: Absetzen/Wiedereinplanen (D10c), Zeitplan verschieben mit ehrlichen Zeiten und
  //    Hallenton (D13, D13b, D13c): der Zeitplan wird während des Tages verschoben, der Hallenton braucht ein laufendes Spiel,
  //    und nach dem Abschluss ist das Turnier gesperrt.
  //  - d01Monitor (@TM-015 Hallen-Monitor) steht vor d08: die Vorbereitung beendet nur die Gruppenspiele auf Feld 1,
  //    auf Feld 2 laufen Gruppe A und B noch (Szenario @TM-015).
  //  - d12 (Korrektur eines beendeten Spiels) und D12b stehen vor d11 (Abschluss): nach dem Abschluss ist jede Korrektur gesperrt.
  //  - D10b (Endstand des abgeschlossenen Turniers) steht nach dem Abschluss.
  ...d00, ...d01, ...d02, ...direktaufruf, ...d03, ...d03b, ...d04, ...d04b, ...d05, ...d05b, ...d10c, ...d06, ...d06b, ...d07, ...d07b,
  ...d13, ...d13Folgen,
  ...d01Monitor, ...d08, ...d08b, ...d09, ...d10, ...d12, ...d11, ...d11b, ...d10b, ...d14, ...d15, ...d18,
];

test.describe('Turniertag-Durchstich (D0a-D18)', () => {
  // 'default' statt 'parallel' (fullyParallel in der Config): die Schritte laufen nacheinander im selben
  // Worker; ein unerwartet grüner Schritt bricht die Kette nicht ab (nur 'serial' würde den Rest überspringen).
  test.describe.configure({ mode: 'default', retries: 0 });

  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!testInfo.project.name.includes('desktop'), 'Der Durchstich läuft einmal, auf cloud-desktop.');
  });

  for (const step of TURNIERTAG_STEPS) {
    test(`${step.id} ${step.title} ${step.scenarios.join(' ')} ${(step.befunde ?? []).join(' ')}`.trim(), async ({ asRole, browser, page }) => {
      test.fail(step.expectedFail, `Besitzer: ${step.owner}`);
      await step.run({ asRole, browser, anonPage: page });
    });
  }
});
