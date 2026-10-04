/**
 * D7b /tv gekoppelt, Drei-Kontexte (Bildschirm, Turnierleitung, Helfer-Handy). Besitzer: B-21.
 * Besitzer: B-21 -- Soll-Marker: der Bildschirm unter `/tv` zeigt seinen Kopplungs-Code
 * (`tv-pairing-code`).
 */
import { expect } from '@playwright/test';
import { expectSollMarker, SOLL_TIMEOUT_MS } from './shared';
import type { StepContext, TurniertagStep } from './types';

async function tvGekoppelt({ anonPage }: StepContext): Promise<void> {
  await anonPage.goto('/#/tv');
  await anonPage.waitForLoadState('networkidle');
  await expectSollMarker(anonPage, 'tv-pairing-code');
  // Soll-Wirkung (sichtbar): der Kopplungs-Code ist ein echter Code (mind. 4 Zeichen, nur Buchstaben/Ziffern/Bindestrich), kein leeres Element.
  await expect(anonPage.locator('[data-testid="tv-pairing-code"]')).toHaveText(/^\s*[A-Z0-9-]{4,}\s*$/i, { timeout: SOLL_TIMEOUT_MS });
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D7b', title: '/tv gekoppelt (Bildschirm, Turnierleitung, Helfer-Handy)', scenarios: [], owner: 'B-21', expectedFail: true, run: tvGekoppelt },
];
