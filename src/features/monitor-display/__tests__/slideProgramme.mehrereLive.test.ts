/**
 * B-44b Mehrere Felder (F2): Vorbelegung `pauseRotationDuringMatch` hält die Folie nur bei genau einer Live-Folie.
 * Mehrere Live-Folien mit je eigenem Feld wechseln auch während laufender Spiele (@ZM-074, @ZM-075, @ZM-079).
 */
import { describe, it, expect } from 'vitest';
import type { MonitorSlide } from '../../../types/monitor';
import { nextSlide, type RuleMatch, type SlideProgram, type SlideshowState } from '../slideProgramme';

const folie = (id: string, type: string, config: object = {}, duration: number | null = 15) =>
  ({ id, type, config, duration, order: 0 }) as MonitorSlide;

const LIVE_F1 = folie('live-f1', 'live', { fieldId: 'field-1', pauseRotationDuringMatch: true });
const LIVE_F2 = folie('live-f2', 'live', { fieldId: 'field-2', pauseRotationDuringMatch: true });
const TABELLE = folie('tabelle', 'standings', { groupId: 'A' });
const BEIDE: RuleMatch[] = [
  { id: 'm1', field: 1, matchStatus: 'running' },
  { id: 'm2', field: 2, matchStatus: 'running' },
];

const programm = (slides: MonitorSlide[], matches: RuleMatch[]): SlideProgram => ({ slides, defaultDurationSec: 15, matches });
const start = (): SlideshowState => ({ index: 0, page: 0, startedAt: 0, direction: 'next' });

describe('Rotation mit zwei Live-Folien', () => {
  it('zwei Live-Folien, beide Spiele laufen: nach 15 s wechselt Feld 1 zu Feld 2, danach zurück', () => {
    const p = programm([LIVE_F1, LIVE_F2], BEIDE);
    const s0 = nextSlide(p, start(), 0);
    expect(s0).toMatchObject({ index: 0 });
    expect(s0.pinnedMatchId ?? null).toBeNull();
    const s1 = nextSlide(p, s0, 15_000);
    expect(s1).toMatchObject({ index: 1 });
    const s2 = nextSlide(p, s1, 30_000);
    expect(s2).toMatchObject({ index: 0 });
  });

  it('zwei Live-Folien und eine Tabelle: auch die Tabelle kommt an die Reihe', () => {
    const p = programm([LIVE_F1, LIVE_F2, TABELLE], BEIDE);
    let s = nextSlide(p, start(), 0);
    const gesehen = new Set<number>([s.index]);
    for (let t = 15_000; t <= 60_000; t += 15_000) { s = nextSlide(p, s, t); gesehen.add(s.index); }
    expect([...gesehen].sort()).toEqual([0, 1, 2]);
  });

  it('Gegenbeispiel: genau eine Live-Folie mit Vorbelegung hält weiter (kein Wechsel über 120 s)', () => {
    const p = programm([LIVE_F1, TABELLE], BEIDE);
    let s = nextSlide(p, start(), 0);
    for (let t = 1_000; t <= 120_000; t += 1_000) { s = nextSlide(p, s, t); expect(s).toMatchObject({ index: 0, pinnedMatchId: 'm1' }); }
  });

  it('Gegenbeispiel: zwei Live-Folien, aber nur auf Feld 1 läuft ein Spiel: Feld-2-Folie bleibt übersprungen', () => {
    const p = programm([LIVE_F1, LIVE_F2, TABELLE], [BEIDE[0]]);
    let s = nextSlide(p, start(), 0);
    const gesehen = new Set<number>([s.index]);
    for (let t = 15_000; t <= 90_000; t += 15_000) { s = nextSlide(p, s, t); gesehen.add(s.index); }
    expect(gesehen.has(1)).toBe(false);
    expect(gesehen.has(2)).toBe(true);
  });
});

describe('Live-Folie ohne eigenes Feld (alle laufenden Spiele)', () => {
  const ALLE = folie('live-alle', 'live', {});

  it('wird übersprungen, solange auf keinem Feld gespielt wird', () => {
    const p = programm([ALLE, TABELLE], [{ id: 'm9', field: 1, matchStatus: 'scheduled' }]);
    expect(nextSlide(p, start(), 0)).toMatchObject({ index: 1 });
  });

  it('bleibt sichtbar, wenn irgendein Feld spielt (nicht übersprungen)', () => {
    const p = programm([ALLE, TABELLE], [{ id: 'm2', field: 2, matchStatus: 'running' }]);
    expect(nextSlide(p, start(), 0)).toMatchObject({ index: 0 });
  });
});
