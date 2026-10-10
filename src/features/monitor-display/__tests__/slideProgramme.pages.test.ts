/** B-16f1 – Eine Folie mit mehreren Seiten blättert (c-Bedenken 2); eine Folie mit einer Seite wechselt nie. */
import { describe, it, expect } from 'vitest';
import type { MonitorSlide } from '../../../types/monitor';
import { nextSlide, wakeAt, type SlideProgram, type SlideshowState } from '../slideProgramme';

const folie = (id: string, duration: number | null = null) =>
  ({ id, type: 'custom-text', config: {}, duration, order: 0 }) as MonitorSlide;

const zustand = (over: Partial<SlideshowState> = {}): SlideshowState => ({
  index: 0, page: 0, startedAt: 0, paused: false, direction: 'next', ...over,
});

describe('@ZM-130 Zeile 3 (Logik): eine Folie mit drei Seiten blättert', () => {
  const dreiSeiten: SlideProgram = { slides: [folie('A', 20)], defaultDurationSec: 15, pageCount: () => 3 };

  it('Seite 1 bei 20 000 ms, 19 999 ms noch Seite 0', () => {
    expect(nextSlide(dreiSeiten, zustand(), 19_999)).toMatchObject({ index: 0, page: 0 });
    expect(nextSlide(dreiSeiten, zustand(), 20_000)).toMatchObject({ index: 0, page: 1, startedAt: 20_000 });
  });

  it('Seite 2 bei 40 000 ms', () => {
    const s1 = zustand({ page: 1, startedAt: 20_000 });
    expect(nextSlide(dreiSeiten, s1, 39_999)).toBe(s1);
    expect(nextSlide(dreiSeiten, s1, 40_000)).toMatchObject({ index: 0, page: 2, startedAt: 40_000 });
  });

  it('bei 60 000 ms beginnt die Folie wieder mit Seite 0 (eine Folie bleibt die einzige)', () => {
    const s2 = zustand({ page: 2, startedAt: 40_000 });
    expect(nextSlide(dreiSeiten, s2, 59_999)).toBe(s2);
    expect(nextSlide(dreiSeiten, s2, 60_000)).toMatchObject({ index: 0, page: 0, startedAt: 60_000 });
  });

  it('wakeAt ist nicht null, sondern das Ende der aktuellen Seite', () => {
    expect(wakeAt(dreiSeiten, zustand())).toBe(20_000);
    expect(wakeAt(dreiSeiten, zustand({ page: 2, startedAt: 40_000 }))).toBe(60_000);
  });
});

describe('Seiten-Klemme: Seitenzahl gesunken', () => {
  it('Seite 2 bei neuer Seitenzahl 1 → Seite 0 mit neuem Takt', () => {
    const p: SlideProgram = { slides: [folie('A', 20)], defaultDurationSec: 15, pageCount: () => 1 };
    expect(nextSlide(p, zustand({ page: 2, startedAt: 5_000 }), 6_000)).toMatchObject({ page: 0, startedAt: 6_000 });
  });
});

describe('Gegenbeispiel: eine Folie mit einer Seite', () => {
  const einzeln: SlideProgram = { slides: [folie('A')], defaultDurationSec: 15, pageCount: () => 1 };

  it('wakeAt ist null', () => {
    expect(wakeAt(einzeln, zustand())).toBeNull();
  });

  it('nach 10 min kein Wechsel (Objekt bleibt gleich)', () => {
    const s = zustand();
    expect(nextSlide(einzeln, s, 600_000)).toBe(s);
  });

  it('ohne pageCount-Funktion ebenso: wakeAt null', () => {
    expect(wakeAt({ slides: [folie('A')], defaultDurationSec: 15 }, zustand())).toBeNull();
  });
});
