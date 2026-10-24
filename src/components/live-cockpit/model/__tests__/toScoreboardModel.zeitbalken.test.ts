/**
 * toScoreboardModel: Zeitbalken und Kopfzeile am Laptop (Plan Cockpit v2 B1). Testwerte aus dem Gherkin:
 * @ZM-166 (Tabelle der Zustände; Spiel 7: Abschnitte zu je 6 Minuten, 1 Minute Halbzeitpause, 2 Minuten Verlängerung),
 * @ZM-145 (der Balken nimmt mit der Restzeit ab, mit 0:00 ist er leer), @SL-180 („Spiel 3 · Feld 1 · 2. Halbzeit“ und „Gespielt 4:06“ in der Kopfzeile).
 * Die Übersetzung ist ein Schlüssel-Stub.
 */
import { describe, it, expect } from 'vitest';
import { toScoreboardModel, BALKEN_TON_SCHLUSSPHASE, type ScoreboardInput } from '../toScoreboardModel';
import { cockpitPhaseOf } from '../cockpitPhase';
import { makeLiveMatch, makePhaseView } from '../../__tests__/cockpitFixtures';
import type { PhaseView } from '../../engine/phaseView';

const t = (key: string, o?: Record<string, unknown>): string => (o ? `${key}:${JSON.stringify(o)}` : key);
const min = (m: number, s = 0): number => (m * 60 + s) * 1000;

function input(view: Partial<PhaseView>, extra: Partial<ScoreboardInput> = {}, uhrArt: ScoreboardInput['uhrArt'] = 'durchlaufend-letzte-minute-angehalten'): ScoreboardInput {
  const v = makePhaseView({ sectionLimitMs: min(6), ...view });
  return {
    match: makeLiveMatch({ homeScore: 1, awayScore: 0 }), phase: cockpitPhaseOf({ view: v, matchStatus: 'RUNNING', leer: null }), view: v,
    links: 'home', rechts: 'away', uhrArt, eintraegeWarten: 0, helferAnfragen: 0, jetztMs: 0, ...extra,
  };
}
const balken = (view: Partial<PhaseView>, extra: Partial<ScoreboardInput> = {}, uhrArt?: ScoreboardInput['uhrArt']) => toScoreboardModel(input(view, extra, uhrArt), t).uhr?.balken;

describe('@ZM-166 Der Zeitbalken zeigt den Zustand des Spiels, nie in Rot', () => {
  it.each([
    ['im ersten Abschnitt bei 3:00, die Uhr läuft: zur Hälfte grün gefüllt', { section: 1, isLastRegularSection: false, sectionElapsedMs: min(3) }, { anteil: 0.5, ton: 'gruen' }],
    ['im zweiten Abschnitt bei 0:30, die Uhr läuft: der Balken beginnt neu und ist zu einem Zwölftel grün gefüllt', { section: 2, sectionElapsedMs: min(5, 30) }, { anteil: 1 / 12, ton: 'gruen' }],
    ['im ersten Abschnitt bei 3:00, die Uhr angehalten: der Balken steht zur Hälfte gefüllt und ist grau', { section: 1, isLastRegularSection: false, status: 'paused', sectionElapsedMs: min(3) }, { anteil: 0.5, ton: 'grau' }],
  ] as const)('%s', (_lage, view, erwartet) => {
    // die Tabelle des Records nennt keine Schlussphase: die Uhr zählt einfach die Restzeit herunter (@ZM-145)
    const b = balken(view, {}, 'immer-durchlaufend');
    expect(b?.ton).toBe(erwartet.ton);
    expect(b?.anteil).toBeCloseTo(erwartet.anteil, 5);
  });

  it('in der Halbzeitpause, noch 0:30 von 1:00: die Pausenzeit läuft gedämpft herunter, halb voll', () => {
    const b = balken({ status: 'section_break', section: 1, isLastRegularSection: false, breakRemainingMs: min(0, 30), breakTotalMs: min(1) });
    expect(b).toEqual({ anteil: 0.5, ton: 'gedaempft' });
  });

  it('in der Verlängerung bei 1:00 von 2 Minuten: der Balken beginnt neu über 2 Minuten und ist halb gefüllt', () => {
    const b = balken({ phase: 'overtime', section: 3, sectionLimitMs: min(2), sectionElapsedMs: min(1) }, { phase: cockpitPhaseOf({ view: makePhaseView({ phase: 'overtime', section: 3, sectionLimitMs: min(2), sectionElapsedMs: min(1) }), matchStatus: 'RUNNING', leer: null }) }, 'immer-durchlaufend');
    expect(b?.anteil).toBeCloseTo(0.5, 5);
    expect(b?.ton).toBe('gruen');
  });

  it('mit abgelaufener Spielzeit, noch nicht abgepfiffen: der Balken ist voll und grün', () => {
    expect(balken({ sectionElapsedMs: min(6) })).toEqual({ anteil: 1, ton: 'gruen' });
  });

  it('Schlussphase der Uhr-Art „letzte Minute angehalten“: der Balken bleibt grün wie am Monitor (Tabelle @ZM-166 kennt keine eigene Farbe), nie rot; die Farbe hängt an einem Schalter', () => {
    const b = balken({ sectionElapsedMs: min(5, 30) });
    expect(b?.ton).toBe(BALKEN_TON_SCHLUSSPHASE);
    expect(b?.ton).toBe('gruen');
    expect(b?.ton).not.toBe('rot');
    expect(b?.anteil).toBeCloseTo(1 / 12, 5);
  });

  it('Gegenbeispiel Uhr-Art „immer durchlaufend“: keine Schlussphase, der Balken bleibt grün', () => {
    expect(balken({ sectionElapsedMs: min(5, 30) }, {}, 'immer-durchlaufend')?.ton).toBe('gruen');
  });

  it.each([
    ['im Strafstoßschießen', { status: 'shootout', phase: 'shootout' }, 'RUNNING'],
    ['beendet', { status: 'finished' }, 'FINISHED'],
  ] as const)('%s gibt es keinen Balken', (_lage, view, matchStatus) => {
    const v = makePhaseView({ sectionLimitMs: min(6), ...view });
    const m = toScoreboardModel(input(view, { phase: cockpitPhaseOf({ view: v, matchStatus, leer: null }), view: v }), t);
    expect(m.uhr?.balken ?? null).toBeNull();
  });

  it('@ZM-145 der Balken nimmt mit der Restzeit ab: eine Sekunde später ist er kürzer, mit 0:00 voll nur vor dem Abpfiff', () => {
    const frueher = balken({ sectionElapsedMs: min(4, 30) })?.anteil ?? 0;
    const spaeter = balken({ sectionElapsedMs: min(4, 31) })?.anteil ?? 0;
    expect(spaeter).toBeLessThan(frueher);
  });
});

describe('@SL-180 Kopfzeile der Tafel am Laptop', () => {
  it('Spiel 3 läuft in der 2. Halbzeit, gespielt 4:06: „Spiel 3 · Feld 1 · 2. Halbzeit · Gespielt 4:06“', () => {
    const m = toScoreboardModel(input({ section: 2, sectionElapsedMs: min(4, 6) }, { match: makeLiveMatch({ number: 3 }), fieldName: 'Feld 1' }), t);
    expect(m.kopfText).toContain('tafel.kopf.spiel:{"nummer":3}');
    expect(m.kopfText).toContain('Feld 1');
    expect(m.kopfText).toContain('tafel.abschnitt.halbzeit:{"nummer":2}');
    expect(m.kopfText).toContain('tafel.kopf.gespielt:{"zeit":"4:06"}');
    expect((m.kopfText ?? '').split(' · ')).toHaveLength(4);
  });

  it('Gegenbeispiel: in der Pause steht keine gespielte Zeit in der Kopfzeile', () => {
    const m = toScoreboardModel(input({ status: 'section_break', section: 1, isLastRegularSection: false, breakRemainingMs: min(0, 40) }, { fieldName: 'Feld 1' }), t);
    expect(m.kopfText ?? '').not.toContain('gespielt');
  });

  it('beide Seiten tragen „Heim“ bzw. „Gast“ für die Stufe „knapp“ (Variante a, @SL-181), auch nach „Seiten tauschen“', () => {
    const m = toScoreboardModel(input({}, { links: 'away', rechts: 'home' }), t);
    expect(m.links.label).toBe('spalte.gast');
    expect(m.rechts.label).toBe('spalte.heim');
  });
});
