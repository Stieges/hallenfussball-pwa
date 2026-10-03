/**
 * D7b /tv gekoppelt, Drei-Kontexte (Bildschirm, Turnierleitung, Helfer-Handy). Besitzer: B-21.
 * Besitzer: B-21 -- Soll-Marker: der Bildschirm unter `/tv` zeigt seinen Kopplungs-Code
 * (`tv-pairing-code`).
 */
import { expectSollMarker } from './shared';
import type { StepContext, TurniertagStep } from './types';

async function tvGekoppelt({ anonPage }: StepContext): Promise<void> {
  await anonPage.goto('/#/tv');
  await anonPage.waitForLoadState('networkidle');
  await expectSollMarker(anonPage, 'tv-pairing-code');
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D7b', title: '/tv gekoppelt (Bildschirm, Turnierleitung, Helfer-Handy)', scenarios: [], owner: 'B-21', expectedFail: true, run: tvGekoppelt },
];
