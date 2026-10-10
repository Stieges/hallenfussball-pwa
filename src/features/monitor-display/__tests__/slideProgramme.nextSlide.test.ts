/** B-16c – Folienfolge als reine Funktionen: Takt-Grenzen, Pause, Tasten, Seiten (@ZM-130 Logik). */
import { describe, it, expect } from 'vitest';
import type { MonitorSlide } from '../../../types/monitor';
import {
  nextSlide,
  stepSlide,
  wakeAt,
  type SlideProgram,
  type SlideshowState,
} from '../slideProgramme';

const folie = (id: string, duration: number | null = null) =>
  ({ id, type: 'custom-text', config: {}, duration, order: 0 }) as MonitorSlide;

const programm = (
  slides: MonitorSlide[],
  defaultDurationSec = 15,
  pageCount?: (s: MonitorSlide) => number,
): SlideProgram => ({ slides, defaultDurationSec, pageCount });

const zustand = (over: Partial<SlideshowState> = {}): SlideshowState => ({
  index: 0, page: 0, startedAt: 0, paused: false, direction: 'next', ...over,
});

const A = folie('A');
const B = folie('B');

describe('nextSlide – Takt-Grenzen (B-16c)', () => {
  it.each([
    ['Standard 15 s: 14 999 ms kein Wechsel', [A, B], 15, zustand(), 14_999, 'same'],
    ['Standard 15 s: 15 000 ms Folie B', [A, B], 15, zustand(), 15_000, { index: 1, page: 0, startedAt: 15_000 }],
    ['eigene Dauer 25 s: 24 999 ms kein Wechsel', [folie('A', 25), B], 15, zustand(), 24_999, 'same'],
    ['eigene Dauer 25 s: 25 000 ms Folie B', [folie('A', 25), B], 15, zustand(), 25_000, { index: 1, startedAt: 25_000 }],
    ['null → Monitor-Standard 20 s: 19 999 ms kein Wechsel', [folie('A', null), B], 20, zustand(), 19_999, 'same'],
    ['null → Monitor-Standard 20 s: 20 000 ms Folie B', [folie('A', null), B], 20, zustand(), 20_000, { index: 1, startedAt: 20_000 }],
    ['letzte Folie → Folie 0, Seite 0', [A, B], 15, zustand({ index: 1 }), 15_000, { index: 0, page: 0, startedAt: 15_000 }],
    ['pausiert, nach 10 min kein Wechsel', [A, B], 15, zustand({ paused: true }), 600_000, 'same'],
    ['eine Folie, nach 10 min kein Wechsel', [A], 15, zustand(), 600_000, 'same'],
    ['keine Folie, nach 10 min kein Wechsel', [], 15, zustand(), 600_000, 'same'],
  ])('%s', (_name, slides, defaultSec, state, now, expected) => {
    const result = nextSlide(programm(slides, defaultSec), state, now);
    if (expected === 'same') {
      expect(result).toBe(state);
    } else {
      expect(result).toMatchObject(expected);
    }
  });
});

describe('@ZM-130 Zeilen 3/4: Seiten je Folie (Logik; Seitenzahl misst B-17)', () => {
  it('3 Seiten, Dauer 20 s → Seitenwechsel bei 20 s und 40 s, Folienwechsel bei 60 s, nicht schon nach der 1. Seite', () => {
    const p = programm([folie('A', 20), B], 15, () => 3);
    const s0 = zustand();
    expect(nextSlide(p, s0, 19_999)).toBe(s0);
    const s1 = nextSlide(p, s0, 20_000);
    expect(s1).toMatchObject({ index: 0, page: 1, startedAt: 20_000 });
    expect(nextSlide(p, s1, 39_999)).toBe(s1);
    const s2 = nextSlide(p, s1, 40_000);
    expect(s2).toMatchObject({ index: 0, page: 2, startedAt: 40_000 });
    expect(nextSlide(p, s2, 59_999)).toBe(s2);
    expect(nextSlide(p, s2, 60_000)).toMatchObject({ index: 1, page: 0, startedAt: 60_000 });
  });

  it('3 Seiten, leere Dauer → Seitenwechsel bei 15 s und 30 s, Folienwechsel bei 45 s', () => {
    const p = programm([folie('A', null), B], 15, () => 3);
    const s1 = nextSlide(p, zustand(), 15_000);
    expect(s1).toMatchObject({ index: 0, page: 1 });
    const s2 = nextSlide(p, s1, 30_000);
    expect(s2).toMatchObject({ index: 0, page: 2 });
    expect(nextSlide(p, s2, 45_000)).toMatchObject({ index: 1, page: 0 });
  });
});

describe('stepSlide – Tasten (B-16c)', () => {
  const dreiFolien = programm([A, B, folie('C')]);

  it('zurück von Folie 0 → letzte Folie, mit neuem Takt und Richtung prev', () => {
    expect(stepSlide(dreiFolien, zustand(), -1, 5_000)).toMatchObject({
      index: 2, page: 0, startedAt: 5_000, direction: 'prev',
    });
  });

  it('vor von der letzten Folie → Folie 0', () => {
    expect(stepSlide(dreiFolien, zustand({ index: 2 }), 1, 5_000)).toMatchObject({
      index: 0, page: 0, startedAt: 5_000, direction: 'next',
    });
  });

  it('Taste setzt die Seite auf 0 und behält den Pausenzustand', () => {
    expect(stepSlide(dreiFolien, zustand({ page: 2, paused: true }), 1, 7_000)).toMatchObject({
      page: 0, startedAt: 7_000, paused: true,
    });
  });
});

describe('wakeAt – nächster Zeitpunkt (B-16c)', () => {
  it('Startzeit + Dauer der Seite; null bei Pause und bei höchstens einer Folie', () => {
    expect(wakeAt(programm([folie('A', 25), B]), zustand({ startedAt: 1_000 }))).toBe(26_000);
    expect(wakeAt(programm([A, B]), zustand({ paused: true }))).toBeNull();
    expect(wakeAt(programm([A]), zustand())).toBeNull();
  });
});
