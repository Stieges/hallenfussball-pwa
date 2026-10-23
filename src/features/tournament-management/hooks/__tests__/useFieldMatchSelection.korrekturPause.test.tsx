/**
 * useFieldMatchSelection: der Countdown des Endstands pausiert, solange die Turnierleitung korrigiert (B-10a2 Fixrunde).
 *
 * Aus dem Gherkin `2026-10-02_spiel-leiten.md` abgeleitet, nicht am Code abgelesen (Spiel 11 abgepfiffen, danach Spiel 13 bereit):
 *   @SL-163  Olli wählt 12 Sekunden nach dem Abpfiff „Korrigieren“ und lässt die Korrektur 2 Minuten offen → danach weiter Endstand
 *            von Spiel 11, nicht zu Spiel 13 gewechselt
 *   @SL-164  nach der Korrektur steht der Endstand noch <Rest>, danach Spiel 13; „Weiter“ wechselt in dieser Zeit sofort
 *            | Sekunde 12, speichert | 18 Sekunden | · | Sekunde 28, speichert | 10 Sekunden | · | Sekunde 28, abbricht | 10 Sekunden |
 * Speichern und Abbrechen enden hier gleich in `setzeFort` (welcher Weg wann `setzeFort` ruft, prüft `useCockpitKorrektur.test.tsx`).
 * Die Engine ist ein Stand-in wie in `useFieldMatchSelection.endstand.test.tsx`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { useFieldMatchSelection } from '../useFieldMatchSelection';
import { MatchEngineContext, type MatchEngineContextValue } from '../../../match-engine/matchEngineContextInstance';
import type { GeneratedSchedule } from '../../../../core/generators';
import type { LiveMatch } from '../../../../components/live-cockpit/types';

const T0 = Date.UTC(2026, 10, 28, 15, 13, 0);
const sek = (s: number): number => s * 1000;

// Feld 1: Spiel 11 (abgepfiffen, 2:1), danach Spiel 13
const schedule = {
  allMatches: [
    { id: 'm11', matchNumber: 11, field: 1, slot: 1, scoreA: 2, scoreB: 1 },
    { id: 'm13', matchNumber: 13, field: 1, slot: 2 },
  ],
} as unknown as GeneratedSchedule;
const live = new Map<string, LiveMatch>([['m11', { id: 'm11', status: 'FINISHED' } as unknown as LiveMatch]]);

/** Spiel 11 wurde vor `vorMs` abgepfiffen (echter Abpfiff, kein Direkteintrag). */
function engineMit(vorMs: number): MatchEngineContextValue {
  const finishedAt = T0 - vorMs;
  return {
    engine: {
      view: (id: string) => (id === 'm11' ? { result: { state: { status: 'finished', finishedAt, baseDecidedBy: 'regular' } } } : null),
      serverNow: () => Date.now(),
      subscribe: () => () => undefined,
    },
  } as unknown as MatchEngineContextValue;
}

function render(vorMs: number) {
  const engine = engineMit(vorMs);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter><MatchEngineContext.Provider value={engine}>{children}</MatchEngineContext.Provider></MemoryRouter>
  );
  return renderHook(() => useFieldMatchSelection({ numberOfFields: 1, schedule, liveMatches: live }), { wrapper });
}
type R = ReturnType<typeof render>;
const zeigt = (r: R): string | undefined => r.result.current.currentMatchData?.id;
const warte = (ms: number): void => { act(() => { vi.advanceTimersByTime(ms); }); };

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(T0); });
afterEach(() => { vi.useRealTimers(); });

describe('@SL-163 Solange Olli in den 30 Sekunden korrigiert, pausiert der Countdown', () => {
  it('Korrektur 12 Sekunden nach dem Abpfiff geöffnet und 2 Minuten offen: das Cockpit zeigt danach weiter Spiel 11, nicht Spiel 13', () => {
    const r = render(sek(12));
    expect(zeigt(r)).toBe('m11');
    act(() => { r.result.current.endstandPause.pausiere('m11'); });
    warte(sek(120));
    expect(zeigt(r)).toBe('m11');
  });

  it('Gegenbeispiel: ohne Korrektur zeigt das Cockpit nach den 30 Sekunden von selbst Spiel 13', () => {
    const r = render(sek(12));
    warte(sek(19));
    expect(zeigt(r)).toBe('m13');
  });

  it('Gegenbeispiel: die Korrektur eines anderen Spiels hält den Endstand von Spiel 11 nicht an', () => {
    const r = render(sek(12));
    act(() => { r.result.current.endstandPause.pausiere('m07'); });
    warte(sek(19));
    expect(zeigt(r)).toBe('m13');
  });
});

describe('@SL-164 Nach der Korrektur läuft der Countdown mit der Restzeit weiter, mindestens 10 Sekunden', () => {
  it.each([
    { sekunde: 12, abschluss: 'speichert', restSek: 18 },
    { sekunde: 28, abschluss: 'speichert', restSek: 10 },
    { sekunde: 28, abschluss: 'abbricht', restSek: 10 },
  ])('bei Sekunde $sekunde geöffnet, Olli $abschluss: der Endstand steht noch $restSek Sekunden, danach Spiel 13', ({ sekunde, restSek }) => {
    const r = render(sek(sekunde));
    act(() => { r.result.current.endstandPause.pausiere('m11'); });
    warte(sek(45)); // Korrektur länger offen als die 30 Sekunden
    act(() => { r.result.current.endstandPause.setzeFort(); });
    warte(sek(restSek) - 100);
    expect(zeigt(r)).toBe('m11'); // Gegenbeispiel zur zu kurzen Restzeit (z. B. 2 Sekunden bei Sekunde 28)
    warte(200);
    expect(zeigt(r)).toBe('m13'); // Gegenbeispiel zu volle 30 Sekunden von vorn
  });

  it('tippt Olli in dieser Zeit „Weiter“, zeigt sein Cockpit sofort Spiel 13', () => {
    const r = render(sek(12));
    act(() => { r.result.current.endstandPause.pausiere('m11'); });
    warte(sek(30));
    act(() => { r.result.current.endstandPause.setzeFort(); });
    warte(sek(2));
    act(() => { r.result.current.ladeNaechstes(); });
    expect(zeigt(r)).toBe('m13');
  });

  it('Gegenbeispiel: „fortsetzen“ ohne vorherige Korrektur verlängert den Endstand nicht', () => {
    const r = render(sek(28));
    act(() => { r.result.current.endstandPause.setzeFort(); });
    warte(sek(2) + 100);
    expect(zeigt(r)).toBe('m13');
  });
});
