/**
 * Folienfolge des Monitors mit Fake-Timern (B-16a2 Fixrunde 1, Spur B). Heutiges Verhalten; was heute
 * nicht dem Soll entspricht, steht als `it.fails` mit grünem „Bestand:“-Zwilling daneben.
 * Jeder Poll liefert einen strukturellen Klon (wie SupabaseRepository.get), die Zeit läuft in Schritten.
 * Keine Produktivdatei wird geändert.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import type { GoalEventInfo } from '../../../hooks/useLiveMatches';
import type { Match, Tournament } from '../../../types/tournament';
import type { MonitorSlide } from '../../../types/monitor';
import {
  attachMonitor, buildTournament, FIXTURE_MATCHES, FIXTURE_SPONSOR, slide, withFlags, withMonitor,
} from './monitorFixture';

const { supabaseGet, localGet, live } = vi.hoisted(() => ({
  supabaseGet: vi.fn(),
  localGet: vi.fn(),
  live: { goal: null as GoalEventInfo | null, clearGoal: vi.fn() },
}));

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { from: vi.fn(() => ({ upsert: vi.fn().mockResolvedValue({}) })), rpc: vi.fn().mockResolvedValue({ error: null }) },
}));
vi.mock('../../../core/repositories/SupabaseRepository', () => ({
  SupabaseRepository: vi.fn(function SupabaseRepository() { return { get: supabaseGet }; }),
}));
vi.mock('../../../core/repositories/LocalStorageRepository', () => ({
  LocalStorageRepository: vi.fn(function LocalStorageRepository() { return { get: localGet }; }),
}));
vi.mock('qrcode.react', async () => {
  const React = await import('react');
  return {
    QRCodeSVG: ({ value }: { value: string }) => React.createElement('svg', { 'data-testid': 'qr-code', 'data-value': value }),
  };
});
vi.mock('../../../hooks/useLiveMatches', () => ({
  useLiveMatches: () => ({
    liveMatches: new Map(), runningMatches: [], pausedMatches: [], runningMatchIds: new Set<string>(),
    getMatchById: () => undefined, lastGoalEvent: live.goal, clearLastGoalEvent: live.clearGoal,
    lastCardEvent: null, clearLastCardEvent: vi.fn(), calculateElapsedSeconds: () => 0,
  }),
}));

import { MonitorDisplayPage } from '../MonitorDisplayPage';

/** Spielliste mit Überschreibungen je Spiel-Id (die Fixture hat keine Verkettung). */
function spiele(patches: Record<string, Partial<Match>>): Match[] {
  return FIXTURE_MATCHES.map(m => ({ ...m, ...patches[m.id] }));
}

/** Folienprogramm „Feld 1“: Live-Spiel, Tabelle Gruppe A, Sponsor – wie in @ZM-074/079. */
function programm(): MonitorSlide[] {
  return [slide('live', { fieldId: 'field-1' }), slide('standings', { groupId: 'A' }), slide('sponsor', { sponsorId: 'sp-1' })];
}

/** Punkte-Zelle (letzte Spalte) der Tabellenzeile eines Teams. */
function pointsOf(teamName: string): string | null {
  return screen.getByText(teamName).parentElement?.lastElementChild?.textContent ?? null;
}

/** Deckkraft des ersten Vorfahren-Elements mit gesetzter Opazität (Übergangs-Wrapper). */
function opazitaet(text: string): string {
  let el: HTMLElement | null = screen.getByText(text);
  while (el && !el.style.opacity) { el = el.parentElement; }
  return el?.style.opacity ?? 'keine';
}

/** Turnier mit eingehängtem Monitor (Profil `high`, Pollen alle 5 s, sofern nicht überschrieben). */
function monitorTurnier(tournament: Tournament, slides: MonitorSlide[], overrides: Parameters<typeof withMonitor>[0] = {}): Tournament {
  return attachMonitor(tournament, withMonitor({ slides, ...overrides }));
}

/** Jeder Poll liefert einen strukturellen Klon, so wie SupabaseRepository.get neue Objekte baut. */
function liefere(data: Tournament): void {
  supabaseGet.mockImplementation(async () => structuredClone(data));
}

/** Startet die Seite über die Cloud-Quelle und lässt den Erstlade-Effekt laufen (Fake-Timer). */
async function starte(data: Tournament): Promise<void> {
  liefere(data);
  localGet.mockResolvedValue(null);
  render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
  await vorspulen(0);
}

/** Spult die Fake-Timer vor und lässt die Effekte danach laufen. */
async function vorspulen(ms: number): Promise<void> {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

/** Spult in Schritten vor, damit zwischen Polls und Timern gerendert wird. */
async function vorspulenInSchritten(ms: number, schritt = 1_000): Promise<void> {
  let rest = ms;
  while (rest > 0) {
    const s = Math.min(schritt, rest);
    await vorspulen(s);
    rest -= s;
  }
}

/** Spult in Schritten vor und prüft nach jedem Schritt (inkl. Start). */
async function vorspulenPruefend(ms: number, pruefe: () => void, schritt = 1_000): Promise<void> {
  pruefe();
  let rest = ms;
  while (rest > 0) {
    const s = Math.min(schritt, rest);
    await vorspulen(s);
    rest -= s;
    pruefe();
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  live.goal = null;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
});

afterEach(() => {
  vi.useRealTimers();
});

const FALLE_DAUER = [
  { fall: 'Monitor-Standard 15 s', overrides: {} },
  { fall: 'ohne Monitor-Standard, Fallback 15 s', overrides: { defaultSlideDuration: undefined as unknown as number } },
];

describe('MonitorDisplayPage — Anzeigedauer je Folie (@ZM-130, Fake-Timer)', () => {
  it('@ZM-130 Zeile 2: Folie mit Dauer 25 s steht 25 s, 1 ms vor Ablauf kein Wechsel', async () => {
    await starte(monitorTurnier(buildTournament(), [
      slide('custom-text', { headline: 'Lange Folie' }, 25),
      slide('custom-text', { headline: 'Kurze Folie' }),
    ]));
    await vorspulenInSchritten(24_999);
    expect(screen.getByText('Lange Folie')).toBeInTheDocument();
    await vorspulen(1);
    expect(screen.getByText('Kurze Folie')).toBeInTheDocument();
  });

  it.each(FALLE_DAUER)('@ZM-130 leere Folien-Dauer ($fall) → 15 s, 1 ms vor Ablauf kein Wechsel', async ({ overrides }) => {
    await starte(monitorTurnier(buildTournament(), [
      slide('custom-text', { headline: 'Erste Folie' }),
      slide('custom-text', { headline: 'Zweite Folie' }),
    ], overrides));
    await vorspulenInSchritten(14_999);
    expect(screen.getByText('Erste Folie')).toBeInTheDocument();
    await vorspulen(1);
    expect(screen.getByText('Zweite Folie')).toBeInTheDocument();
  });

  // Ohne Klon: Dieser Test prüft den Übergang des Takt-Timers, nicht den Datenweg. Mit einem Klon je Poll
  // würde der Timer bei jedem Poll zurückgesetzt (C-MON-TAKT-STEHT) und nie feuern.
  // Gegenbeispiele zum Takt-Fix: Dauer- und Tastenänderungen setzen den Takt neu, ein Poll mit reinem
  // Inhaltswechsel setzt ihn nicht zurück.
  it('@ZM-130 Poll ändert die Dauer der nächsten Folie: sie gilt ab dem Wechsel auf sie', async () => {
    const folienA = slide('custom-text', { headline: 'Folie A' });
    const folienB = slide('custom-text', { headline: 'Folie B' });
    await starte(monitorTurnier(buildTournament(), [folienA, folienB]));
    liefere(monitorTurnier(buildTournament(), [folienA, { ...folienB, duration: 25 }]));
    await vorspulenInSchritten(14_999);
    expect(screen.getByText('Folie A')).toBeInTheDocument();
    await vorspulen(1);
    expect(screen.getByText('Folie B')).toBeInTheDocument();
    await vorspulenInSchritten(24_999);
    expect(screen.getByText('Folie B')).toBeInTheDocument();
    await vorspulen(1);
    expect(screen.getByText('Folie A')).toBeInTheDocument();
  });

  it('@ZM-130 Taste startet den Takt neu: nächster Wechsel 15 s nach der Taste', async () => {
    await starte(monitorTurnier(buildTournament(), [
      slide('custom-text', { headline: 'Folie A' }),
      slide('custom-text', { headline: 'Folie B' }),
      slide('custom-text', { headline: 'Folie C' }),
    ]));
    await vorspulenInSchritten(10_000);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('Folie B')).toBeInTheDocument();
    await vorspulenInSchritten(14_999);
    expect(screen.getByText('Folie B')).toBeInTheDocument();
    await vorspulen(1);
    expect(screen.getByText('Folie C')).toBeInTheDocument();
  });

  it('@ZM-130 Poll mit Inhaltswechsel bei 10 s verschiebt den Wechsel nicht (weiterhin 15 000 ms)', async () => {
    const folienA = slide('custom-text', { headline: 'Folie A' });
    const folienB = slide('custom-text', { headline: 'Folie B' });
    await starte(monitorTurnier(buildTournament(), [folienA, folienB]));
    await vorspulenInSchritten(9_000);
    liefere(monitorTurnier(buildTournament({ matches: spiele({ 'match-7': { scoreA: 2 } }) }), [folienA, folienB]));
    await vorspulen(1_000);
    await vorspulenInSchritten(4_999);
    expect(screen.getByText('Folie A')).toBeInTheDocument();
    await vorspulen(1);
    expect(screen.getByText('Folie B')).toBeInTheDocument();
  });

  it('Bestand: Ein-Folien-Monitor wechselt nicht und blendet nicht aus (Übergang fade)', async () => {
    const daten = monitorTurnier(buildTournament(), [slide('custom-text', { headline: 'Einzige Folie' })], {
      transition: 'fade', transitionDuration: 500,
    });
    supabaseGet.mockResolvedValue(daten);
    localGet.mockResolvedValue(null);
    render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
    await vorspulen(0);
    await vorspulenPruefend(15_000, () => {
      expect(opazitaet('Einzige Folie')).toBe('1');
    });
    await vorspulen(500);
    expect(opazitaet('Einzige Folie')).toBe('1');
  });
});

describe('MonitorDisplayPage — Folienfolge bei laufendem Spiel (Fake-Timer)', () => {
  // Pflichttest @ZM-079 über die gerenderte Seite mit echtem Timer-Pfad und Klon je Poll.
  it('@ZM-079 Anhalten aus: Live-Spiel, Tabelle und Sponsor wechseln im Takt (15 s, 30 s)', async () => {
    const folien = [
      slide('live', { fieldId: 'field-1', pauseRotationDuringMatch: false }),
      slide('standings', { groupId: 'A' }),
      slide('sponsor', { sponsorId: 'sp-1' }),
    ];
    await starte(monitorTurnier(buildTournament({ sponsors: [FIXTURE_SPONSOR] }), folien));
    await vorspulenInSchritten(14_999);
    expect(screen.getByLabelText('Heim: 1')).toBeInTheDocument();
    await vorspulen(1);
    expect(screen.queryByLabelText('Heim: 1')).not.toBeInTheDocument();
    expect(screen.getByText(/Gruppe A/)).toBeInTheDocument();
    await vorspulenInSchritten(14_999);
    expect(screen.queryByText('Bäckerei Maier')).not.toBeInTheDocument();
    await vorspulen(1);
    expect(screen.getByText('Bäckerei Maier')).toBeInTheDocument();
  });

  // @ZM-074: Live-Spiel hält die Folie zwei Minuten lang (Pin, kein Takt).
  it('@ZM-074 1. Halbzeit: Live-Spiel bleibt zwei Minuten stehen', async () => {
    await starte(monitorTurnier(buildTournament({ sponsors: [FIXTURE_SPONSOR] }), programm()));
    await vorspulenPruefend(120_000, () => {
      expect(screen.getByLabelText('Heim: 1')).toBeInTheDocument();
    }, 5_000);
    const beendet = spiele({ 'match-7': { matchStatus: 'finished', scoreA: 2, scoreB: 1 } });
    liefere(monitorTurnier(buildTournament({ sponsors: [FIXTURE_SPONSOR], matches: beendet }), programm()));
    let sponsorGesehen = false;
    // 30 s Endergebnis (ab dem Poll bei 125 s) + 15 s Tabelle = Sponsor bei 170 s; das Fenster deckt das ab.
    await vorspulenPruefend(55_000, () => {
      if (screen.queryByText('Bäckerei Maier')) { sponsorGesehen = true; }
    });
    expect(sponsorGesehen).toBe(true);
  });

  it('Bestand: Live-Folie zeigt zu Beginn das laufende Spiel 7 mit Stand 1:0', async () => {
    await starte(monitorTurnier(buildTournament({ sponsors: [FIXTURE_SPONSOR] }), programm()));
    expect(screen.getByLabelText('Heim: 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Gast: 0')).toBeInTheDocument();
  });

  // @ZM-075: Der Poll liefert Spiel 9 als laufend. Live-Folie mit Spiel 9 direkt nach dem Poll.
  const folienTabelleLive = () => [slide('standings', { groupId: 'A' }), slide('live', { fieldId: 'field-1' })];
  const vorAnpfiff = () => spiele({ 'match-7': { matchStatus: 'finished', scoreA: 2, scoreB: 1 } });
  const nachAnpfiff = () => spiele({ 'match-7': { matchStatus: 'finished', scoreA: 2, scoreB: 1 }, 'match-9': { matchStatus: 'running' } });

  it('@ZM-075 Anpfiff: Monitor zeigt nach dem Poll das Live-Spiel 9', async () => {
    const folien = folienTabelleLive();
    await starte(monitorTurnier(buildTournament({ matches: vorAnpfiff() }), folien));
    liefere(monitorTurnier(buildTournament({ matches: nachAnpfiff() }), folien));
    await vorspulen(5_000);
    expect(screen.getByText('Kickers West')).toBeInTheDocument();
  });

  // @ZM-077: Abpfiff mit 2:1 – Soll: 2:1 bis 29 999 ms nach dem Abpfiff, bei 30 000 ms die nächste Folie.
  const folienLive = () => [slide('live', { fieldId: 'field-1' }), slide('standings', { groupId: 'A' })];
  const nachAbpfiff = () => spiele({ 'match-7': { matchStatus: 'finished', scoreA: 2, scoreB: 1 } });

  it('@ZM-077 Abpfiff: Live-Folie zeigt 2:1 bis 29 999 ms, bei 30 000 ms die nächste Folie', async () => {
    const folien = folienLive();
    await starte(monitorTurnier(buildTournament(), folien));
    liefere(monitorTurnier(buildTournament({ matches: nachAbpfiff() }), folien));
    await vorspulen(5_000);
    await vorspulenPruefend(29_999, () => {
      expect(screen.getByLabelText('Heim: 2')).toBeInTheDocument();
    });
    await vorspulen(1);
    expect(screen.queryByLabelText('Heim: 2')).not.toBeInTheDocument();
    expect(screen.getByText(/Gruppe A/)).toBeInTheDocument();
  });

  // @ZM-122: Erstes Spiel auf Feld 1 um 13:00, Stand 12:45 – die Live-Folie darf über einen Durchlauf nicht erscheinen.
  const ersterSpielUm13 = () => buildTournament({
    matches: spiele({
      'match-7': { field: 2 },
      'match-9': { scheduledTime: new Date('2026-10-10T13:00:00') },
    }),
  });

  it('@ZM-122 erstes Spiel 13:00: Feld-1-Monitor überspringt die Live-Folie über einen Durchlauf', async () => {
    await starte(monitorTurnier(ersterSpielUm13(), folienLive()));
    await vorspulenPruefend(30_000, () => {
      expect(screen.queryByText('Nächstes Spiel')).not.toBeInTheDocument();
    });
    expect(screen.getByText(/Gruppe A/)).toBeInTheDocument();
  });

  // @ZM-090: Kindermodus, Programm hat nur Tabelle – Soll: die Zuschauer-QR-Folie.
  it.fails('@ZM-090 Kindermodus: ohne zeigbare Folie zeigt der Monitor die Zuschauer-QR-Folie', async () => {
    await starte(monitorTurnier(buildTournament(withFlags({ hideScoresForPublic: true })), [slide('standings', { groupId: 'A' })]));
    expect(screen.getByTestId('qr-code')).toBeInTheDocument();
  });

  it('Bestand: Kindermodus-Monitor mit nur einer Tabelle zeigt Punkte statt QR-Folie', async () => {
    const turnier = buildTournament({
      ...withFlags({ hideScoresForPublic: true }),
      matches: spiele({ 'match-7': { scoreA: undefined, scoreB: undefined } }),
    });
    await starte(monitorTurnier(turnier, [slide('standings', { groupId: 'A' })]));
    expect(pointsOf('FC Nord')).toBe('3');
    expect(screen.queryByTestId('qr-code')).not.toBeInTheDocument();
  });

  // @ZM-118: Kindermodus – Soll: keine Tor-Einblendung. Bestand: die Einblendung erscheint.
  it.fails('@ZM-118 Kindermodus: Tor in Spiel 8 wird nicht eingeblendet', async () => {
    live.goal = goalInMatch8();
    await starte(monitorTurnier(buildTournament({ sponsors: [FIXTURE_SPONSOR], hideScoresForPublic: true }), [slide('sponsor', { sponsorId: 'sp-1' })]));
    expect(screen.queryByText('DJK Berg')).not.toBeInTheDocument();
  });

  it('Bestand: Tor-Einblendung „DJK Berg“ erscheint trotz Kindermodus', async () => {
    live.goal = goalInMatch8();
    await starte(monitorTurnier(buildTournament({ sponsors: [FIXTURE_SPONSOR], hideScoresForPublic: true }), [slide('sponsor', { sponsorId: 'sp-1' })]));
    expect(screen.getByText('DJK Berg')).toBeInTheDocument();
  });
});

function goalInMatch8(): GoalEventInfo {
  return { matchId: 'match-8', teamId: 'team-berg', teamName: 'DJK Berg', side: 'home', timestamp: 1, newScore: { home: 1, away: 0 } };
}

describe('MonitorDisplayPage — Datenweg (Bestand, ergänzend zu dataSource-Test)', () => {
  it('Bestand: vor dem ersten Monitor-Laden pollt die Seite alle 5 s (Grenzen 4 999 / 5 000 ms)', async () => {
    supabaseGet.mockRejectedValue(new Error('offline'));
    localGet.mockResolvedValue(null);
    render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
    await vorspulen(0);
    const start = supabaseGet.mock.calls.length;
    await vorspulen(4_999);
    expect(supabaseGet).toHaveBeenCalledTimes(start);
    await vorspulen(1);
    expect(supabaseGet).toHaveBeenCalledTimes(start + 1);
  });

  it.each([
    { modus: 'high' as const, takt: 5_000 },
    { modus: 'low' as const, takt: 10_000 },
  ])('Bestand: Profil $modus pollt alle $takt ms (Grenzen beidseitig)', async ({ modus, takt }) => {
    await starte(monitorTurnier(buildTournament(), [slide('custom-text', { headline: 'Hallo' })], { performanceMode: modus }));
    const start = supabaseGet.mock.calls.length;
    await vorspulen(takt - 1);
    expect(supabaseGet).toHaveBeenCalledTimes(start);
    await vorspulen(1);
    expect(supabaseGet).toHaveBeenCalledTimes(start + 1);
  });

  it('Bestand: hängende Cloud-Anfrage wird bei 4 000 ms abgebrochen, der lokale Abruf startet erst dann', async () => {
    supabaseGet.mockReturnValue(new Promise<never>(() => undefined));
    localGet.mockResolvedValue(null);
    render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
    await vorspulen(3_999);
    expect(localGet).not.toHaveBeenCalled();
    await vorspulen(1);
    expect(localGet).toHaveBeenCalledTimes(1);
  });
});
