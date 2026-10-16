/**
 * B-03 (V3) — @OB-004-Gruppe aus B03.platzhalterListe.test.tsx.
 * Gemeinsame Mocks und Helfer: ./helpers/b03PlatzhalterHarness.tsx.
 * Jeder Test unverändert; 30 s Timeout je Fall (kein globales testTimeout).
 */
import { describe, it, vi, beforeEach } from 'vitest';
import { expectAbsent, expectRendered, renderSettingsScreen } from './helpers/b03PlatzhalterHarness';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('@OB-004 Ein ausgeblendeter Platzhalter kommt mit einer neuen App-Version nicht zurück', () => {
  it('@OB-004 Die vier Schalter „App-Verhalten“ fehlen auch nach dem erneuten Öffnen', async () => {
    const first = await renderSettingsScreen();
    expectAbsent(/behavior\.confirmDelete/, /behavior\.autoSave/, /behavior\.timerSound/, /behavior\.hapticFeedback/);
    first.unmount();
    const second = await renderSettingsScreen();
    expectRendered(second.container);
    expectAbsent(/behavior\.confirmDelete/, /behavior\.autoSave/, /behavior\.timerSound/, /behavior\.hapticFeedback/);
  }, 30_000);
});
