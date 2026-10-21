/**
 * useFieldMatchSelection: der Endstand bleibt nach dem Abpfiff stehen (B-10a, Befund C-COCKPIT-ENDSTAND-NACH-AUTOENDE).
 *
 * Aus dem Gherkin `2026-10-02_spiel-leiten.md` abgeleitet, nicht am Code abgelesen:
 *   @SL-073 / @SL-152  nach dem Abpfiff zeigt das Cockpit 30 Sekunden lang das abgepfiffene Spiel (Endstand), nicht schon das nächste;
 *                      danach von selbst das nächste Spiel (@SL-049, @SL-117)
 *   @SL-162            „Weiter“ wechselt vor Ablauf der 30 Sekunden sofort
 *   @SL-116            nach einer Übernahme zählt der Rest der 30 Sekunden ab dem Abpfiff, nicht ab der Übernahme
 * Die Engine ist ein Stand-in mit dem, was die Auswahl liest (`view`, `serverNow`, `subscribe`); die Abpfiff-Zeit
 * (`finishedAt`) steht im Zustand der Engine, so wie sie auch auf einem zweiten Gerät ankommt.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { useFieldMatchSelection } from '../useFieldMatchSelection';
import { MatchEngineContext, type MatchEngineContextValue } from '../../../match-engine/matchEngineContextInstance';
import type { GeneratedSchedule } from '../../../../core/generators';
import type { LiveMatch } from '../../../../components/live-cockpit/types';

const T0 = Date.UTC(2026, 9, 21, 15, 0, 0);

const spiel = (id: string, nr: number, extra: Record<string, unknown> = {}): Record<string, unknown> => ({ id, matchNumber: nr, field: 1, slot: nr, ...extra });
const schedule = (ergebnis11: boolean, ergebnis12 = false): GeneratedSchedule => ({
  allMatches: [
    spiel('m11', 11, ergebnis11 ? { scoreA: 2, scoreB: 1 } : {}),
    spiel('m12', 12, ergebnis12 ? { scoreA: 0, scoreB: 0 } : {}),
    spiel('m13', 13),
  ],
}) as unknown as GeneratedSchedule;

const live = (id: string, status: LiveMatch['status']): LiveMatch => ({ id, status }) as unknown as LiveMatch;
const karte = (...e: [string, LiveMatch['status']][]): ReadonlyMap<string, LiveMatch> => new Map(e.map(([id, s]) => [id, live(id, s)]));

/** Versatz der Serverzeit gegen die Geräteuhr (ClockSync misst alle 60 s neu und kann ihn ändern). */
let versatz = 0;

/**
 * Engine-Stand-in: `finishedAt` je Spiel; `null` = Spiel nicht beendet. `direkt` = Direkteintrag im Spielplan (RESULT_ENTRY setzt
 * `finishedAt`, aber nicht `baseDecidedBy`), sonst echter Abpfiff (`baseDecidedBy: 'regular'`).
 */
function engineMit(finishedAt: Record<string, number | null>, direkt: readonly string[] = []): MatchEngineContextValue {
  const engine = {
    view: (id: string) => (id in finishedAt
      ? { result: { state: { status: finishedAt[id] === null ? 'running' : 'finished', finishedAt: finishedAt[id], baseDecidedBy: direkt.includes(id) ? null : 'regular' } } }
      : null),
    serverNow: () => Date.now() + versatz,
    subscribe: () => () => undefined,
  };
  return { engine } as unknown as MatchEngineContextValue;
}

interface Props { engine: MatchEngineContextValue | null; schedule: GeneratedSchedule; live: ReadonlyMap<string, LiveMatch>; initialMatchId?: string }
function render(p: Props) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter><MatchEngineContext.Provider value={p.engine}>{children}</MatchEngineContext.Provider></MemoryRouter>
  );
  return renderHook((q: Props) => useFieldMatchSelection({
    numberOfFields: 1, schedule: q.schedule, liveMatches: q.live, initialMatchId: q.initialMatchId,
  }), { wrapper, initialProps: p });
}
const aktuell = (r: { result: { current: { currentMatchData: { id: string } | undefined } } }): string | undefined => r.result.current.currentMatchData?.id;

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(T0); versatz = 0; });
afterEach(() => { vi.useRealTimers(); });

describe('Endstand halten (@SL-152, @SL-073)', () => {
  it('@SL-152 5 Sekunden nach dem Abpfiff zeigt das Cockpit noch Spiel 11, nicht Spiel 12', () => {
    const r = render({ engine: engineMit({ m11: T0 - 5_000 }), schedule: schedule(true), live: karte(['m11', 'FINISHED']) });
    expect(aktuell(r)).toBe('m11');
  });

  it('@SL-152 nach den 30 Sekunden zeigt das Cockpit von selbst Spiel 12 (ohne Tipp)', () => {
    const r = render({ engine: engineMit({ m11: T0 - 5_000 }), schedule: schedule(true), live: karte(['m11', 'FINISHED']) });
    expect(aktuell(r)).toBe('m11');
    act(() => { vi.advanceTimersByTime(24_000); });
    expect(aktuell(r)).toBe('m11'); // Gegenbeispiel: bei 29 Sekunden noch nicht
    act(() => { vi.advanceTimersByTime(2_000); });
    expect(aktuell(r)).toBe('m12');
  });

  it('Gegenbeispiel: ohne Abpfiff-Zeit in den letzten 30 Sekunden (vor 31 Sekunden beendet) steht Spiel 12', () => {
    const r = render({ engine: engineMit({ m11: T0 - 31_000 }), schedule: schedule(true), live: karte(['m11', 'FINISHED']) });
    expect(aktuell(r)).toBe('m12');
  });

  it('Gegenbeispiel: ohne Engine (kein Abpfiff-Zeitpunkt bekannt) bleibt es beim bisherigen Wechsel zu Spiel 12', () => {
    const r = render({ engine: null, schedule: schedule(true), live: karte(['m11', 'FINISHED']) });
    expect(aktuell(r)).toBe('m12');
  });

  it('Gegenbeispiel: ein ausgefallenes Spiel (Zustand „skipped“, ohne Abpfiff-Zeit) wird nicht gehalten', () => {
    const engine = { engine: { view: () => ({ result: { state: { status: 'skipped', finishedAt: null, baseDecidedBy: null } } }), serverNow: () => Date.now(), subscribe: () => () => undefined } } as unknown as MatchEngineContextValue;
    const r = render({ engine, schedule: schedule(true), live: karte(['m11', 'FINISHED']) });
    expect(aktuell(r)).toBe('m12');
  });

  it('Gegenbeispiel (S1): ein im Spielplan nachgetragenes Ergebnis (Direkteintrag) ist kein Abpfiff und wird nicht gehalten', () => {
    const r = render({ engine: engineMit({ m11: T0 - 2_000 }, ['m11']), schedule: schedule(true), live: karte(['m11', 'FINISHED']) });
    expect(aktuell(r)).toBe('m12');
  });

  it('@SL-152 zwei Spiele des Felds in der Frist beendet: es steht das zuletzt abgepfiffene (auch wenn es früher im Plan steht)', () => {
    const plan = { allMatches: [spiel('m10', 10, { scoreA: 1, scoreB: 1 }), spiel('m11', 11, { scoreA: 2, scoreB: 1 }), spiel('m12', 12)] } as unknown as GeneratedSchedule;
    const lebend = karte(['m10', 'FINISHED'], ['m11', 'FINISHED']);
    expect(aktuell(render({ engine: engineMit({ m10: T0 - 20_000, m11: T0 - 2_000 }), schedule: plan, live: lebend }))).toBe('m11');
    expect(aktuell(render({ engine: engineMit({ m10: T0 - 2_000, m11: T0 - 20_000 }), schedule: plan, live: lebend }))).toBe('m10');
  });

  it('@SL-049 wird die Serverzeit in den 30 Sekunden zurückgestellt, wechselt das Cockpit trotzdem von selbst (Vorspulen in zwei Schritten)', () => {
    const r = render({ engine: engineMit({ m11: T0 - 5_000 }), schedule: schedule(true), live: karte(['m11', 'FINISHED']) });
    expect(aktuell(r)).toBe('m11');
    versatz = -200; // ClockSync misst neu: die Frist endet nun 200 ms später
    act(() => { vi.advanceTimersByTime(25_100); }); // der erste Timer feuert, die Frist läuft noch
    expect(aktuell(r)).toBe('m11');
    act(() => { vi.advanceTimersByTime(65_000); }); // ein zweiter Timer muss gestellt sein
    expect(aktuell(r)).toBe('m12');
  });

  it('Gegenbeispiel: läuft schon Spiel 12 (anderes Gerät), gilt das laufende Spiel, nicht der Endstand', () => {
    const r = render({
      engine: engineMit({ m11: T0 - 5_000, m12: null }), schedule: schedule(true),
      live: karte(['m11', 'FINISHED'], ['m12', 'RUNNING']),
    });
    expect(aktuell(r)).toBe('m12');
  });
});

describe('„Weiter“ (@SL-162)', () => {
  it('@SL-162 „Weiter“ nach 5 Sekunden wechselt sofort zu Spiel 12; Gegenbeispiel: ohne Tipp bleibt Spiel 11', () => {
    const r = render({ engine: engineMit({ m11: T0 - 5_000 }), schedule: schedule(true), live: karte(['m11', 'FINISHED']) });
    expect(aktuell(r)).toBe('m11');
    act(() => { r.result.current.ladeNaechstes(); });
    expect(aktuell(r)).toBe('m12');
  });

  it('@SL-162 das Spiel 11 kommt nach „Weiter“ nicht zurück, auch wenn es das letzte Spiel des Felds war', () => {
    const nurEins = { allMatches: [spiel('m11', 11, { scoreA: 2, scoreB: 1 })] } as unknown as GeneratedSchedule;
    const r = render({ engine: engineMit({ m11: T0 - 5_000 }), schedule: nurEins, live: karte(['m11', 'FINISHED']) });
    expect(aktuell(r)).toBe('m11');
    act(() => { r.result.current.ladeNaechstes(); });
    expect(aktuell(r)).toBeUndefined();
  });
});

describe('Übernahme (@SL-116)', () => {
  it('@SL-116 vor 10 Sekunden abgepfiffen: Olli sieht den Endstand noch 20 Sekunden, danach Spiel 12', () => {
    const r = render({ engine: engineMit({ m11: T0 - 10_000 }), schedule: schedule(true), live: karte(['m11', 'FINISHED']) });
    expect(aktuell(r)).toBe('m11');
    act(() => { vi.advanceTimersByTime(19_000); });
    expect(aktuell(r)).toBe('m11');
    act(() => { vi.advanceTimersByTime(2_000); });
    expect(aktuell(r)).toBe('m12');
  });

  it('@SL-116 vor 1 Minute abgepfiffen: Olli sieht gleich Spiel 12 ohne den Endstand', () => {
    const r = render({ engine: engineMit({ m11: T0 - 60_000 }), schedule: schedule(true), live: karte(['m11', 'FINISHED']) });
    expect(aktuell(r)).toBe('m12');
  });
});

describe('Spiel aus dem Spielplan geöffnet (?matchId=) endet von selbst', () => {
  it('@SL-049 nach dem Ende von selbst steht der Endstand 30 Sekunden, danach Spiel 12 (die Auswahl hält das Spiel nicht fest)', () => {
    const e = { m11: null as number | null };
    const engine = engineMit(e);
    const r = render({ engine, schedule: schedule(false), live: karte(['m11', 'RUNNING']), initialMatchId: 'm11' });
    expect(aktuell(r)).toBe('m11');
    // Spielende von selbst
    e.m11 = Date.now();
    r.rerender({ engine, schedule: schedule(true), live: karte(['m11', 'FINISHED']), initialMatchId: undefined });
    expect(aktuell(r)).toBe('m11');
    act(() => { vi.advanceTimersByTime(31_000); });
    expect(aktuell(r)).toBe('m12');
  });

  it('Gegenbeispiel: die Kopie eines lange beendeten Spiels springt beim Laden von „läuft“ auf „beendet“ (Nachholen vom Server): das geöffnete Spiel bleibt stehen', () => {
    const lange = engineMit({ m11: T0 - 600_000 });
    const r = render({ engine: lange, schedule: schedule(true), live: karte(['m11', 'RUNNING']), initialMatchId: 'm11' });
    expect(aktuell(r)).toBe('m11');
    r.rerender({ engine: lange, schedule: schedule(true), live: karte(['m11', 'FINISHED']), initialMatchId: undefined });
    expect(aktuell(r)).toBe('m11');
  });

  it('Gegenbeispiel: ein schon lange beendetes Spiel, das Tom bewusst aus dem Spielplan öffnet, bleibt stehen', () => {
    const r = render({ engine: engineMit({ m11: T0 - 600_000 }), schedule: schedule(true), live: karte(['m11', 'FINISHED']), initialMatchId: 'm11' });
    expect(aktuell(r)).toBe('m11');
  });

  it('Gegenbeispiel (S4): ein früher gewähltes, dann beendetes Spiel gibt ein später bewusst geöffnetes nicht frei', () => {
    const lange = engineMit({ m11: T0 - 600_000 });
    const r = render({ engine: lange, schedule: schedule(false), live: karte(['m11', 'RUNNING']), initialMatchId: 'm11' });
    act(() => { r.result.current.setFeld(1); }); // Auswahl zurück auf „automatisch“, während Spiel 11 noch läuft
    r.rerender({ engine: lange, schedule: schedule(true), live: karte(['m11', 'FINISHED']), initialMatchId: undefined });
    r.rerender({ engine: lange, schedule: schedule(true), live: karte(['m11', 'FINISHED']), initialMatchId: 'm11' }); // Zurück/Vor in der Adresse
    expect(aktuell(r)).toBe('m11');
  });
});
