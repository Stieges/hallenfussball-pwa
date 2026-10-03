/**
 * tests/e2e/cloud/turniertag.spec.ts — der Durchstich (A-23, Plan § 8): EIN Ablauf über den
 * Turniertag, Schritte D1-D15 als Module unter `turniertag/steps/` (eine Datei je Besitzer-
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
import { steps as d01 } from './turniertag/steps/d01-anlegen';
import { steps as d02 } from './turniertag/steps/d02-cloud-stand';
import { steps as direktaufruf } from './turniertag/steps/direktaufruf';
import { steps as d03 } from './turniertag/steps/d03-helfer-qr';
import { steps as d04 } from './turniertag/steps/d04-anpfiff-tor-karte';
import { steps as d05 } from './turniertag/steps/d05-offline-tor';
import { steps as d06 } from './turniertag/steps/d06-halbzeit-zeitstrafe';
import { steps as d07 } from './turniertag/steps/d07-zuschauer-live';
import { steps as d07b } from './turniertag/steps/d07b-tv-gekoppelt';
import { steps as d08 } from './turniertag/steps/d08-gruppenabschluss-hf';
import { steps as d09 } from './turniertag/steps/d09-hf-elfmeter';
import { steps as d10 } from './turniertag/steps/d10-finale-nichtantritt';
import { steps as d11 } from './turniertag/steps/d11-abschluss-sperre';
import { steps as d12 } from './turniertag/steps/d12-korrektur';
import { steps as d13 } from './turniertag/steps/d13-zeitplan-verschieben';
import { steps as d14 } from './turniertag/steps/d14-pdf-sicherung';
import { steps as d15 } from './turniertag/steps/d15-zweites-turnier';
import type { TurniertagStep } from './turniertag/steps/types';

export const TURNIERTAG_STEPS: readonly TurniertagStep[] = [
  ...d01, ...d02, ...direktaufruf, ...d03, ...d04, ...d05, ...d06, ...d07, ...d07b, ...d08, ...d09, ...d10, ...d11, ...d12, ...d13, ...d14, ...d15,
];

test.describe('Turniertag-Durchstich (D1-D15)', () => {
  // 'default' statt 'parallel' (fullyParallel in der Config): die Schritte laufen nacheinander im selben
  // Worker; ein unerwartet grüner Schritt bricht die Kette nicht ab (nur 'serial' würde den Rest überspringen).
  test.describe.configure({ mode: 'default' });

  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!testInfo.project.name.includes('desktop'), 'Der Durchstich läuft einmal, auf cloud-desktop.');
  });

  for (const step of TURNIERTAG_STEPS) {
    test(`${step.id} ${step.title} ${step.scenarios.join(' ')}`.trim(), async ({ asRole, browser, page }) => {
      test.fail(step.expectedFail, `Besitzer: ${step.owner}`);
      await step.run({ asRole, browser, anonPage: page });
    });
  }
});
