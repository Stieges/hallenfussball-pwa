/**
 * B-16e1 – Spielregeln der Folienfolge als Folienfolge-Tabellen (reine Funktionen, Zeit in ms).
 * Anhalten während eines Spiels (@ZM-074, @ZM-075), Endergebnis 30 s (@ZM-077), Live-Folie überspringen
 * (@ZM-122), Takt läuft bei ausgeschaltetem Anhalten weiter (@ZM-079), Feldbindung der Folie.
 */
import { describe, it, expect } from 'vitest';
import type { MonitorSlide } from '../../../types/monitor';
import {
  FINAL_RESULT_HOLD_MS,
  alleUebersprungen,
  nextSlide,
  wakeAt,
  type RuleMatch,
  type SlideProgram,
  type SlideshowState,
} from '../slideProgramme';

const folie = (id: string, type: string, config: object = {}, duration: number | null = 15) =>
  ({ id, type, config, duration, order: 0 }) as MonitorSlide;

const LIVE_F1 = folie('live-f1', 'live', { fieldId: 'field-1' });
const TABELLE = folie('tabelle', 'standings', { groupId: 'A' });
const SPONSOR = folie('sponsor', 'sponsor', { sponsorId: 'sp-1' });

const programm = (slides: MonitorSlide[], matches: RuleMatch[] = []): SlideProgram => ({
  slides, defaultDurationSec: 15, matches,
});

const zustand = (over: Partial<SlideshowState> = {}): SlideshowState => ({
  index: 0, page: 0, startedAt: 0, direction: 'next', ...over,
});

/** Lässt die Regeln in Schritten von `schritt` ms über `dauer` ms laufen und liefert jeden Zustand. */
function laufe(p: SlideProgram, start: SlideshowState, von: number, dauer: number, schritt = 1_000): SlideshowState[] {
  const zustaende: SlideshowState[] = [];
  let s = start;
  for (let t = von; t <= von + dauer; t += schritt) {
    s = nextSlide(p, s, t);
    zustaende.push(s);
  }
  return zustaende;
}

describe('@ZM-074 Anhalten: laufendes Spiel auf dem Feld der Live-Folie hält die Folie (120 s)', () => {
  // Zeile 1: laufend · Zeile 2: Halbzeit (`paused`) · Zeile 3: laufend mit angehaltener Uhr (Status bleibt running)
  it.each([
    ['1. Halbzeit', 'running'],
    ['Halbzeit', 'paused'],
    ['1. Halbzeit, Uhr angehalten', 'running'],
  ])('Phase „%s“: Live-Folie bleibt, kein Takt', (_phase, _status) => {
    // Alle drei Lagen sind für die Ansicht „live“ (`isLive`): Halbzeit und angehaltene Uhr zählen mit (@ZM-039)
    const p = programm([LIVE_F1, TABELLE, SPONSOR], [{ id: 'm7', field: 1, isLive: true }]);
    const zustaende = laufe(p, zustand(), 0, 120_000);
    for (const s of zustaende) {
      expect(s.index).toBe(0);
      expect(s.pinnedMatchId).toBe('m7');
    }
    expect(wakeAt(p, zustaende.at(-1) ?? zustand())).toBeNull();
  });
});

describe('@ZM-075 Anpfiff: Live-Folie zeigt das Spiel direkt nach dem Empfang der Daten', () => {
  it('Tabelle, dann Poll mit laufendem Spiel 9 auf Feld 1 → Live-Folie gepinnt', () => {
    const vorher = programm([TABELLE, LIVE_F1], [{ id: 'm9', field: 1, isLive: false }]);
    const nachher = programm([TABELLE, LIVE_F1], [{ id: 'm9', field: 1, isLive: true }]);
    const s0 = nextSlide(vorher, zustand(), 0);
    expect(s0.index).toBe(0);
    expect(nextSlide(nachher, s0, 5_000)).toMatchObject({ index: 1, pinnedMatchId: 'm9', startedAt: 5_000 });
  });
});

describe('@ZM-077 Abpfiff: Endergebnis 30 s, danach die folgende Folie', () => {
  const vorAbpfiff = programm([LIVE_F1, TABELLE], [{ id: 'm7', field: 1, isLive: true }]);
  const nachAbpfiff = programm([LIVE_F1, TABELLE], [{ id: 'm7', field: 1, isLive: false }]);

  it('Haltezeit ist 30 000 ms', () => {
    expect(FINAL_RESULT_HOLD_MS).toBe(30_000);
  });

  it('29 999 ms: Endergebnis bleibt; 30 000 ms: Tabelle', () => {
    const gepinnt = nextSlide(vorAbpfiff, zustand(), 0);
    const beendet = nextSlide(nachAbpfiff, gepinnt, 5_000);
    expect(beendet).toMatchObject({ index: 0, pinnedMatchId: 'm7', finalUntil: 35_000 });
    expect(nextSlide(nachAbpfiff, beendet, 34_999)).toBe(beendet);
    expect(wakeAt(nachAbpfiff, beendet)).toBe(35_000);
    expect(nextSlide(nachAbpfiff, beendet, 35_000)).toMatchObject({ index: 1, pinnedMatchId: null, finalUntil: null });
  });
});

describe('@ZM-122 Live-Folie ohne Spiel auf ihrem Feld wird übersprungen (60 s)', () => {
  const ohneSpielAufFeld1: Array<{ name: string; matches: RuleMatch[] }> = [
    { name: '12:45, erstes Spiel Feld 1 um 13:00', matches: [{ id: 'm9', field: 1, isLive: false }, { id: 'm8', field: 2, isLive: false }] },
    { name: 'letztes Spiel Feld 1 beendet, Feld 2 läuft Spiel 8', matches: [{ id: 'm1', field: 1, isLive: false }, { id: 'm8', field: 2, isLive: true }] },
    { name: 'kein Spiel auf Feld 1, Feld 2 läuft Spiel 8', matches: [{ id: 'm8', field: 2, isLive: true }] },
  ];

  it.each(ohneSpielAufFeld1)('$name: Live-Folie nie sichtbar, Tabelle zeigt sich', ({ matches }) => {
    const p = programm([LIVE_F1, TABELLE], matches);
    const zustaende = laufe(p, zustand(), 0, 60_000);
    for (const s of zustaende) {
      expect(s.index).toBe(1);
    }
  });
});

describe('@ZM-079 Anhalten aus: Takt läuft trotz laufendem Spiel', () => {
  it('Live-Folie mit pauseRotationDuringMatch false: nach 15 s die Tabelle', () => {
    const live = folie('live-f1', 'live', { fieldId: 'field-1', pauseRotationDuringMatch: false });
    const p = programm([live, TABELLE], [{ id: 'm7', field: 1, isLive: true }]);
    const s0 = nextSlide(p, zustand(), 0);
    expect(s0.index).toBe(0);
    expect(s0.pinnedMatchId ?? null).toBeNull();
    expect(nextSlide(p, s0, 14_999)).toBe(s0);
    expect(nextSlide(p, s0, 15_000)).toMatchObject({ index: 1 });
  });
});

describe('Feldbindung: Spiel auf Feld 2 pinnt die Live-Folie von Feld 1 nicht', () => {
  it('Feld-1-Live bleibt übersprungen, obwohl auf Feld 2 gespielt wird', () => {
    const p = programm([LIVE_F1, TABELLE], [{ id: 'm8', field: 2, isLive: true }]);
    const zustaende = laufe(p, zustand(), 0, 60_000);
    for (const s of zustaende) {
      expect(s.index).toBe(1);
      expect(s.pinnedMatchId ?? null).toBeNull();
    }
  });
});

describe('@ZM-079 Anhalten im laufenden Spiel ausgeschaltet: Pin löst sich, Takt läuft', () => {
  it('gepinnt auf laufendem Spiel, Schalter aus → sofort gelöst, nach 15 s die nächste Folie', () => {
    const live = folie('live-f1', 'live', { fieldId: 'field-1', pauseRotationDuringMatch: false });
    const p = programm([live, TABELLE], [{ id: 'm7', field: 1, isLive: true }]);
    const gepinnt = zustand({ pinnedMatchId: 'm7' });
    const geloest = nextSlide(p, gepinnt, 1_000);
    expect(geloest).toMatchObject({ index: 0, pinnedMatchId: null, finalUntil: null, startedAt: 1_000 });
    expect(nextSlide(p, geloest, 15_999)).toBe(geloest);
    expect(nextSlide(p, geloest, 16_000)).toMatchObject({ index: 1 });
  });

  it('Gegenbeispiel: Anhalten an → Pin bleibt über 120 s', () => {
    const p = programm([LIVE_F1, TABELLE], [{ id: 'm7', field: 1, isLive: true }]);
    const zustaende = laufe(p, zustand({ pinnedMatchId: 'm7' }), 0, 120_000);
    for (const s of zustaende) { expect(s).toMatchObject({ index: 0, pinnedMatchId: 'm7' }); }
  });
});

describe('Rückfall: alle Folien übersprungen (Ruling B-16e1)', () => {
  it('nur Live-Folie, kein Spiel auf Feld 1 → alle übersprungen', () => {
    expect(alleUebersprungen([LIVE_F1], [{ id: 'm9', field: 1, isLive: false }])).toBe(true);
  });

  it('Gegenbeispiel: Spiel läuft auf Feld 1 → nicht übersprungen', () => {
    expect(alleUebersprungen([LIVE_F1], [{ id: 'm7', field: 1, isLive: true }])).toBe(false);
  });

  it('Gegenbeispiel: Tabelle in der Liste → nicht übersprungen', () => {
    expect(alleUebersprungen([LIVE_F1, TABELLE], [])).toBe(false);
  });

  it('leere Liste → nicht übersprungen (Rückfall regelt selectDisplayableSlides)', () => {
    expect(alleUebersprungen([], [])).toBe(false);
  });
});

