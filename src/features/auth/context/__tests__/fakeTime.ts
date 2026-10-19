/**
 * Fake-Zeit für AuthProvider-Tests (C-SITZUNG-STILL, Nachkontrolle T1).
 *
 * Ein einziger großer Sprung in EINEM `act` belegt keinen Takt: React übernimmt Zustand und Effekte erst am
 * Ende von `act`, ein Effekt, der erst nach einer Zustandsänderung startet (etwa die Wiederverbindung bei
 * „offline“), läuft im Sprung nie. `advanceInSteps` dreht die Zeit in 1-s-Schritten, jeweils in `act`, wie im
 * echten Ablauf.
 */

import { act } from '@testing-library/react';
import { vi } from 'vitest';

export async function advanceInSteps(ms: number, step = 1_000): Promise<void> {
  for (let elapsed = 0; elapsed < ms; elapsed += step) {
    const next = Math.min(step, ms - elapsed);
    await act(async () => { await vi.advanceTimersByTimeAsync(next); });
  }
}
