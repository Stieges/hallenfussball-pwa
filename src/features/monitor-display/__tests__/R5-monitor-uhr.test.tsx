/**
 * R5 PR 2 – Uhr und Zeitbalken am Hallenmonitor (Live-Folie, echte deutsche Texte). Testwerte aus dem Gherkin:
 * @ZM-176 (Uhr folgt dem steuernden Gerät, ≤ 1 s), @ME-031 (Rechneruhr geht 7 Minuten nach → 6:00 ± 1 s),
 * @ZM-084 (Pause bei 06:41, Weiter, „Zeit abgelaufen“ über der Uhr), @ZM-166 (Grundriss je Zeile), @ZM-165 (Höhe/Breite),
 * @ZM-085 (ohne neue Antwort bis 0:00, nie darunter), @ZM-180 (beendet bleibt beendet). Plan R5 PR 2, Tests 1, 3, 4, 5, 7.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';

vi.unmock('i18next'); vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

import { LiveSlide } from '../slides/LiveSlide';
import { buildMonitorView } from '../monitorView';
import { MonitorServerClock } from '../monitorServerClock';
import { slide } from './monitorFixture';
import { looseVs } from '../../../test/matchSlotFixtures';
import { NowSourceContext } from '../../../components/schedule/useTickingNow';
import { displayLayout } from '../../../design-tokens';
import type { ClockMode } from '../../../core/match/clockDisplay';
import { DEFAULT_MATCH_COCKPIT_SETTINGS, type Match, type Team, type Tournament } from '../../../types/tournament';
import { createMockTournament } from '../../../test/factories';
import { PERFORMANCE_PROFILES } from '../../../types/monitor';

/** Serverzeit des Turniertags (14:00 UTC). */
const SERVER = Date.UTC(2026, 10, 28, 14, 0, 0);
const MIN = 60_000;

const teams: Team[] = [{ id: 'nord', name: 'FC Nord' }, { id: 'sued', name: 'SV Süd' }];

interface Lage {
  status: 'running' | 'paused' | 'section_break';
  phase?: 'regular' | 'overtime' | 'shootout';
  section: number;
  /** Gespielt im Abschnitt (ms) zum Anker */
  gespieltMs: number;
  /** Uhr läuft seit diesem Serverzeitpunkt (null = steht) */
  anchorAt: number | null;
  sectionSeconds?: number;
  breakStartedAt?: number | null;
}

/** Spiel 7 auf Feld 1 mit Feinstatus in Serverzeit (Abschnitte zu `sectionSeconds`, 1 Minute Halbzeitpause, 2 Minuten Verlängerung). */
function spiel7(lage: Lage, matchStatus: Match['matchStatus'] = 'running'): Match {
  const laenge = lage.sectionSeconds ?? 360;
  const start = lage.phase === 'overtime' ? 2 * laenge * 1000 : (lage.section - 1) * laenge * 1000;
  return {
    id: 'm7', matchNumber: 7, round: 1, field: 1, group: 'A', ...looseVs('nord', 'sued'), scoreA: 1, scoreB: 0, matchStatus,
    liveState: {
      status: lage.status, phase: lage.phase ?? 'regular', section: lage.section, sections: 2, sectionSeconds: laenge,
      overtimeSeconds: 120, sectionStartMs: start, elapsedMs: start + lage.gespieltMs, anchorAt: lage.anchorAt,
      breakStartedAt: lage.breakStartedAt ?? null, breakSeconds: 60,
    },
  };
}

function turnier(match: Match, clockMode: ClockMode = 'immer-durchlaufend', minuten = 12): Tournament {
  return createMockTournament({
    id: 't1', date: '2026-11-28', teams, gamePeriods: 2, groupPhaseGameDuration: minuten, matches: [match],
    matchCockpitSettings: { ...DEFAULT_MATCH_COCKPIT_SETTINGS, clockMode, finalPhaseMinutes: 1 },
  });
}

/** Live-Folie Feld 1 mit „jetzt“ aus `jetzt` (Serverzeit-Bereitsteller wie auf der Monitor-Seite). */
function zeige(t: Tournament, jetzt: () => number, pinnedMatchId?: string) {
  const props = { slide: slide('live', { fieldId: 'field-1' }), performanceSettings: PERFORMANCE_PROFILES.high, style: {} };
  const baue = (tt: Tournament) => (
    <NowSourceContext.Provider value={jetzt}>
      <LiveSlide {...props} theme="dark" tournament={tt} view={buildMonitorView(tt, jetzt())} pinnedMatchId={pinnedMatchId} />
    </NowSourceContext.Provider>
  );
  const r = render(baue(t));
  return { ...r, neu: (tt: Tournament) => r.rerender(baue(tt)) };
}

const uhrText = () => screen.getByTestId('monitor-clock').textContent;
const ueberDerUhr = () => screen.getByTestId('clock-label').textContent;

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('@ZM-176 @ME-031 Die Uhr folgt der Serverzeit, nicht der Uhr des Hallen-Rechners (Test 1)', () => {
  it('@ME-031 Rechneruhr geht 7 Minuten nach, Spiel 7 läuft seit 4:00, Halbzeit 10 Minuten: Restzeit 06:00 (± 0)', () => {
    vi.setSystemTime(SERVER - 7 * MIN);
    const uhr = new MonitorServerClock();
    // Antwort von display_tournament: 80 ms unterwegs, Server stand dabei auf SERVER
    uhr.observe(SERVER, Date.now() - 80, Date.now());
    zeige(turnier(spiel7({ status: 'running', section: 1, gespieltMs: 0, anchorAt: SERVER - 4 * MIN, sectionSeconds: 600 }), 'immer-durchlaufend', 20), () => uhr.nowMs());
    expect(uhrText()).toBe('06:00');
  });

  it('@ZM-176 Anker vom steuernden Gerät (Restzeit 4:00 bei t0), Monitor-Rechner geht 7 Minuten vor: 2 s später zeigt er 03:58', () => {
    vi.setSystemTime(SERVER + 2000 + 7 * MIN);
    const uhr = new MonitorServerClock();
    uhr.observe(SERVER + 2000, Date.now() - 40, Date.now());
    zeige(turnier(spiel7({ status: 'running', section: 1, gespieltMs: 120_000, anchorAt: SERVER })), () => uhr.nowMs());
    expect(uhrText()).toBe('03:58');
  });
});

describe('@ZM-084 Pause und Weiter (Test 3)', () => {
  it('Tom drückt bei 06:41 „Pause“: die Uhr steht bei 06:41, über der Uhr „angehalten“, das Abzeichen sagt „Pause“; „Weiter“ → läuft ab 06:41', () => {
    vi.setSystemTime(SERVER);
    const lange = { sectionSeconds: 600 };
    const angehalten = spiel7({ status: 'paused', section: 1, gespieltMs: 199_000, anchorAt: null, ...lange });
    const { neu } = zeige(turnier(angehalten, 'immer-durchlaufend', 20), () => Date.now());
    expect(uhrText()).toBe('06:41');
    expect(ueberDerUhr()).toBe('angehalten');
    expect(screen.getByTestId('live-badge')).toHaveTextContent('Pause');
    act(() => { vi.advanceTimersByTime(5000); });
    expect(uhrText()).toBe('06:41');

    neu(turnier(spiel7({ status: 'running', section: 1, gespieltMs: 199_000, anchorAt: Date.now(), ...lange }), 'immer-durchlaufend', 20));
    expect(uhrText()).toBe('06:41');
    expect(ueberDerUhr()).toBe('Restzeit');
    act(() => { vi.advanceTimersByTime(1100); });
    expect(uhrText()).toBe('06:40');
  });
});

describe('Takt an der Sekundengrenze (Test 4)', () => {
  it('Serverzeit x.900 nach dem letzten Wechsel der Spieluhr: die Anzeige wechselt höchstens 150 ms nach dem Sekundenwechsel', () => {
    vi.setSystemTime(SERVER + 900);
    zeige(turnier(spiel7({ status: 'running', section: 1, gespieltMs: 60_000, anchorAt: SERVER })), () => Date.now());
    expect(uhrText()).toBe('05:00');
    act(() => { vi.advanceTimersByTime(99); });
    expect(uhrText()).toBe('05:00');
    act(() => { vi.advanceTimersByTime(150); });
    expect(uhrText()).toBe('04:59');
  });
});

describe('@ZM-166 Der Zeitbalken zeigt den Zustand des Spiels, nie in Rot (Test 5)', () => {
  const laeuft = (section: number, restSek: number, phase: Lage['phase'] = 'regular', laenge = 360): Lage =>
    ({ status: 'running', phase, section, gespieltMs: (laenge - restSek) * 1000, anchorAt: SERVER });
  const zeilen: ReadonlyArray<[string, Lage, ClockMode, string, string, string]> = [
    ['im ersten Abschnitt bei 3:00, die Uhr läuft', laeuft(1, 180), 'immer-durchlaufend', '0.500', 'gruen', 'Restzeit'],
    ['im zweiten Abschnitt bei 0:30, die Uhr läuft', laeuft(2, 30), 'immer-durchlaufend', '0.083', 'gruen', 'Restzeit'],
    ['im ersten Abschnitt bei 3:00, Tom hat die Uhr angehalten', { ...laeuft(1, 180), status: 'paused', anchorAt: null }, 'immer-durchlaufend', '0.500', 'grau', 'angehalten'],
    ['in der Halbzeitpause, noch 0:30 Pause', { status: 'section_break', section: 1, gespieltMs: 360_000, anchorAt: null, breakStartedAt: SERVER - 30_000 }, 'immer-durchlaufend', '0.500', 'gedaempft', 'Pause · Halbzeit'],
    ['in der Verlängerung bei 1:00, die Uhr läuft', laeuft(2, 60, 'overtime', 120), 'immer-durchlaufend', '0.500', 'gruen', 'Verlängerung'],
    ['mit abgelaufener Spielzeit, noch nicht abgepfiffen', laeuft(2, 0), 'immer-durchlaufend', '0.000', 'gruen', 'Zeit abgelaufen'],
    ['in der Schlussphase bei Uhr-Art „durchlaufend, letzte x Minuten angehalten“, Uhr läuft', laeuft(2, 30), 'durchlaufend-letzte-minute-angehalten', '0.083', 'violett', 'Restzeit'],
    ['in den letzten Minuten bei jeder anderen Uhr-Art (durchlaufend ohne Schlussphase)', laeuft(2, 30), 'immer-durchlaufend', '0.083', 'gruen', 'Restzeit'],
    ['in den letzten Minuten bei jeder anderen Uhr-Art (Netto)', laeuft(2, 30), 'immer-angehalten', '0.083', 'gruen', 'Restzeit'],
  ];
  it.each(zeilen)('%s', (_lage, lage, mode, anteil, ton, text) => {
    vi.setSystemTime(SERVER);
    zeige(turnier(spiel7(lage), mode), () => Date.now());
    const balken = screen.getByTestId('monitor-zeitbalken');
    expect(balken).toHaveAttribute('data-anteil', anteil);
    expect(balken).toHaveAttribute('data-ton', ton);
    expect(ueberDerUhr()).toBe(text);
    // nie rot: die Füllung trägt einen Ton der Tafel, nie die Live-Farbe des Abzeichens
    expect(balken.querySelector<HTMLElement>('div')?.style.background).not.toMatch(/live|rose|red/i);
  });

  it('im Strafstoßschießen: kein Balken, kein Zeit-Text', () => {
    vi.setSystemTime(SERVER);
    zeige(turnier(spiel7({ status: 'running', phase: 'shootout', section: 2, gespieltMs: 0, anchorAt: null })), () => Date.now());
    expect(screen.queryByTestId('monitor-zeitbalken')).toBeNull();
    expect(screen.queryByTestId('clock-label')).toBeNull();
    expect(screen.queryByTestId('monitor-clock')).toBeNull();
  });

  it('beendet: kein Balken, kein Zeit-Text', () => {
    vi.setSystemTime(SERVER);
    zeige(turnier({ ...spiel7({ status: 'running', section: 2, gespieltMs: 360_000, anchorAt: null }), matchStatus: 'finished' }), () => Date.now());
    expect(screen.queryByTestId('monitor-zeitbalken')).toBeNull();
    expect(screen.queryByTestId('clock-label')).toBeNull();
  });
});

describe('@ZM-165 Der Zeitbalken ist aus der Halle gut zu sehen', () => {
  it('etwa 3 % der Bildhöhe hoch, so breit wie die beiden Kästen (Token), nur der erste Abschnitt', () => {
    vi.setSystemTime(SERVER);
    zeige(turnier(spiel7({ status: 'running', section: 1, gespieltMs: 180_000, anchorAt: SERVER })), () => Date.now());
    const balken = screen.getByTestId('monitor-zeitbalken');
    expect(balken.style.height).toBe(displayLayout.scoreArea.progressHeight);
    expect(displayLayout.scoreArea.progressHeight).toBe('3cqh');
    expect(balken.parentElement?.style.maxWidth).toBe(displayLayout.scoreArea.progressWidth);
    // erster Abschnitt 3:00 von 6:00 → halb, nicht 3:00 von 12:00 (ganzes Spiel → drei Viertel)
    expect(balken).toHaveAttribute('data-anteil', '0.500');
  });
});

describe('@ZM-085 Ohne neue Antwort zählt die Uhr bis 0:00 und nie darunter (Test 7)', () => {
  it('Restzeit 0:45, danach 5 Minuten keine Antwort: 00:00, „Zeit abgelaufen“, Balken leer', () => {
    vi.setSystemTime(SERVER);
    zeige(turnier(spiel7({ status: 'running', section: 2, gespieltMs: 315_000, anchorAt: SERVER })), () => Date.now());
    expect(uhrText()).toBe('00:45');
    act(() => { vi.advanceTimersByTime(46_000); });
    expect(uhrText()).toBe('00:00');
    act(() => { vi.advanceTimersByTime(5 * MIN); });
    expect(uhrText()).toBe('00:00');
    expect(ueberDerUhr()).toBe('Zeit abgelaufen');
    expect(screen.getByTestId('monitor-zeitbalken')).toHaveAttribute('data-anteil', '0.000');
  });
});

describe('@ZM-180 Ein beendetes Spiel bleibt auf dem Monitor beendet', () => {
  it('Spiel 7 ist mit 2:1 beendet; danach kommt noch der Anker eines laufenden Spiels (1:1, läuft) mit: weiter Endstand, keine Uhr, kein Balken', () => {
    vi.setSystemTime(SERVER);
    const beendet: Match = { ...spiel7({ status: 'running', section: 2, gespieltMs: 360_000, anchorAt: null }), scoreA: 2, scoreB: 1, matchStatus: 'finished' };
    // die Live-Folie hält das beendete Spiel (Haltezeit @ZM-077)
    const { neu } = zeige(turnier(beendet), () => Date.now(), 'm7');
    expect(screen.getByText('Endstand')).toBeInTheDocument();
    // älterer Stand des Spielverlaufs: Uhr läuft im 2. Abschnitt, 1:1 – das Spiel bleibt in der Turnierkopie beendet
    const nachzuegler = spiel7({ status: 'running', section: 2, gespieltMs: 200_000, anchorAt: SERVER - 10_000 });
    neu(turnier({ ...beendet, liveState: nachzuegler.liveState }));
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.getByText('Endstand')).toBeInTheDocument();
    expect(screen.queryByTestId('monitor-clock')).toBeNull();
    expect(screen.queryByTestId('monitor-zeitbalken')).toBeNull();
  });
});
