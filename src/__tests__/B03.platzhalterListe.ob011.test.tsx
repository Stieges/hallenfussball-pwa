/**
 * B-03 (V3) — @OB-011-Gruppe aus B03.platzhalterListe.test.tsx.
 * Gemeinsame Mocks und Helfer: ./helpers/b03PlatzhalterHarness.tsx.
 * Jeder Test unverändert; 30 s Timeout je Fall (kein globales testTimeout).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SRC_ROOT } from './helpers/b03PlatzhalterHarness';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('@OB-011 Eine Folie ohne Darstellung zeigt keinen Entwickler-Hinweis', () => {
  it('@OB-011 Keine Folie zeigt „wird in Phase 2 implementiert“, der Monitor fällt auf die Zuschauer-QR-Folie zurück', async () => {
    const source = readFileSync(
      join(SRC_ROOT, 'features', 'monitor-display', 'MonitorDisplayPage.tsx'),
      'utf8'
    );
    expect(source).not.toMatch(/wird in Phase 2 implementiert/);
    const { selectDisplayableSlides } = await import('../features/monitor-display/slideProgramme');
    const slides = selectDisplayableSlides([
      { id: 'a', type: 'unknown-type', duration: 10 },
      { id: 'b', type: 'sponsor', duration: 10 },
    ]);
    expect(slides.map((slide) => slide.id)).toEqual(['b']);
    const fallback = selectDisplayableSlides([{ id: 'a', type: 'unknown-type', duration: 10 }]);
    expect(fallback.map((slide) => slide.type)).toContain('qr-code');
  }, 30_000);
});
