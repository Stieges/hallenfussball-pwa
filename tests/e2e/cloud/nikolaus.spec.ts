/**
 * tests/e2e/cloud/nikolaus.spec.ts — Durchstich der Hauptlinie „Nikolaus-Turnier TEST“ (Meilenstein M-S/M-T, `meilenstein-setup-nikolaus.md`):
 * die Schritte N1 bis N7 als Module unter `turniertag/steps/nikolaus-*.ts`, abgespielt in dieser Reihenfolge auf dem frisch geseedeten
 * Turnier (`scripts/lib/nikolausSeed.ts`, Daten `nikolausCup.ts`). Läuft NUR gegen den lokalen Stack und nur auf `cloud-desktop`.
 *
 * Gleiche Regeln wie `turniertag.spec.ts`: ein Schritt, dessen Besitzer-Aufgabe noch nicht gebaut ist, ist `test.fail` mit "Besitzer: <Aufgabe>";
 * wird er unerwartet grün, meldet Playwright "Expected to fail, but passed" - dann gehört er auf `expectedFail: false`. Ohne neuen Seed
 * (`npm run test:env:seed`) ist das Turnier verbraucht. Die Hauptlinie steht neben dem K.-o.-Durchstich (`turniertag.spec.ts`, Nebenlinie).
 */
import { test } from './fixtures';
import { steps as plan } from './turniertag/steps/nikolaus-plan';
import { steps as spiel } from './turniertag/steps/nikolaus-spiel';
import { steps as tabelle } from './turniertag/steps/nikolaus-tabelle';
import type { TurniertagStep } from './turniertag/steps/types';

export const NIKOLAUS_STEPS: readonly TurniertagStep[] = [...plan, ...spiel, ...tabelle];

// ÜBERGANG bis zur Zählerregel für Schritt-Specs (Folge F4, Plattform/TM-1): Die Befunde der erwartet roten Schritte stehen je Schritt in `befunde`
// (Wächter TM-1). Die zwei Kennungen im Titel stehen nur hier, damit der Szenario-Zähler (`test.fail` im Rumpf ohne Verweis) nicht steigt;
// sie beschreiben nicht jeden Schritt.
test.describe('Nikolaus-Durchstich (N1-N7) C-TABELLE-NICHT-BFV-PRIVAT C-ZUSTAND-ABGELEITET', () => {
  // Nacheinander im selben Worker; ein unerwartet grüner Schritt bricht die Kette nicht ab.
  test.describe.configure({ mode: 'default', retries: 0 });

  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!testInfo.project.name.includes('desktop'), 'Der Durchstich läuft einmal, auf cloud-desktop.');
  });

  for (const step of NIKOLAUS_STEPS) {
    test(`${step.id} ${step.title} ${step.scenarios.join(' ')} ${(step.befunde ?? []).join(' ')}`.trim(), async ({ asRole, browser, page }) => {
      test.setTimeout(120_000);
      test.fail(step.expectedFail, `Besitzer: ${step.owner}`);
      await step.run({ asRole, browser, anonPage: page });
    });
  }
});
