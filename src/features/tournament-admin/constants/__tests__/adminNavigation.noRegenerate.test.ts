/**
 * @OB-006 / @OB-007 (G1, Fixrunde 1 Teil b) — Die Sidebar bietet
 * „Spielplan neu generieren" NICHT an. Der Text wurde in
 * constants/admin.constants.ts (DANGER_ZONE_ITEMS) auf „Gefahrenbereich"
 * umbenannt (Commit 879daf0f); ohne diesen Test blieb eine Rückbenennung
 * unentdeckt (Probe P2b: 37/37 grün). Der Text erscheint in Sidebar,
 * MobileHub und der Kopfzeile — alle lesen dieselben Navigations-Einträge.
 *
 * Test: keine Navigationsbeschriftung bietet „Spielplan neu generieren" an.
 * Gegenprobe (manuell): Rückbenennung des Labels macht diesen Test rot.
 */
import { describe, it, expect } from 'vitest';
import { ADMIN_CATEGORIES, DANGER_ZONE_ITEMS } from '../admin.constants';

describe('Admin-Navigation — „Spielplan neu generieren" wird nie angeboten (@OB-006, G1)', () => {
  it('keine Navigationsbeschriftung bietet „Spielplan neu generieren" an', () => {
    const navTexts = [...ADMIN_CATEGORIES, ...DANGER_ZONE_ITEMS].flatMap((item) => [
      item.label,
      item.shortLabel ?? '',
      item.description ?? '',
    ]);

    for (const text of navTexts) {
      expect(text).not.toMatch(/Spielplan neu generieren/i);
    }
  });
});
