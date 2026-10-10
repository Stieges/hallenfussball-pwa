/**
 * Folienfolge des Monitors mit Fake-Timern (B-16a2, Spur B). Heutiges Verhalten; was heute
 * nicht dem Soll entspricht, steht als `it.fails` mit grünem „Bestand:“-Zwilling daneben.
 * Keine Produktivdatei wird geändert.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
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

/** Turnier mit eingehängtem Monitor (Profil `high`, Pollen alle 5 s, sofern nicht überschrieben). */
function monitorTurnier(tournament: Tournament, slides: MonitorSlide[], overrides: Parameters<typeof withMonitor>[0] = {}): Tournament {
  return attachMonitor(tournament, withMonitor({ slides, ...overrides }));
}

/** Startet die Seite über die Cloud-Quelle und lässt den Erstlade-Effekt laufen (Fake-Timer). */
async function starte(data: Tournament): Promise<void> {
  supabaseGet.mockResolvedValue(data);
  localGet.mockResolvedValue(null);
  render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
  await vorspulen(0);
}

/** Spult die Fake-Timer vor und lässt die Effekte danach laufen. */
async function vorspulen(ms: number): Promise<void> {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

beforeEach(() => {
  vi.clearAllMocks();
  live.goal = null;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('MonitorDisplayPage — Anzeigedauer je Folie (@ZM-130, Fake-Timer)', () => {
  it('@ZM-130 Zeile 2: Folie mit Dauer 25 s steht 25 s, 1 ms vor Ablauf kein Wechsel', async () => {
    await starte(monitorTurnier(buildTournament(), [
      slide('custom-text', { headline: 'Lange Folie' }, 25),
      slide('custom-text', { headline: 'Kurze Folie' }),
    ]));
    expect(screen.getByText('Lange Folie')).toBeInTheDocument();
    await vorspulen(24_999);
    expect(screen.getByText('Lange Folie')).toBeInTheDocument();
    expect(screen.queryByText('Kurze Folie')).not.toBeInTheDocument();
    await vorspulen(1);
    expect(screen.getByText('Kurze Folie')).toBeInTheDocument();
  });

  it.each([
    { fall: 'Monitor-Standard 15 s', overrides: {} },
    { fall: 'ohne Monitor-Standard, Fallback 15 s', overrides: { defaultSlideDuration: undefined as unknown as number } },
  ])('@ZM-130 leere Folien-Dauer ($fall) → 15 s, 1 ms vor Ablauf kein Wechsel', async ({ overrides }) => {
    await starte(monitorTurnier(buildTournament(), [
      slide('custom-text', { headline: 'Erste Folie' }),
      slide('custom-text', { headline: 'Zweite Folie' }),
    ], overrides));
    await vorspulen(14_999);
    expect(screen.getByText('Erste Folie')).toBeInTheDocument();
    await vorspulen(1);
    expect(screen.getByText('Zweite Folie')).toBeInTheDocument();
  });
});

describe('MonitorDisplayPage — Folienfolge bei laufendem Spiel (Fake-Timer)', () => {
  // Pflichttest @ZM-079 über die gerenderte Seite mit echtem Timer-Pfad.
  it('@ZM-079 Anhalten aus: Live-Spiel, Tabelle und Sponsor wechseln im Takt (15 s, 30 s)', async () => {
    const folien = [
      slide('live', { fieldId: 'field-1', pauseRotationDuringMatch: false }),
      slide('standings', { groupId: 'A' }),
      slide('sponsor', { sponsorId: 'sp-1' }),
    ];
    await starte(monitorTurnier(buildTournament({ sponsors: [FIXTURE_SPONSOR] }), folien));
    expect(screen.getByLabelText('Heim: 1')).toBeInTheDocument();
    await vorspulen(14_999);
    expect(screen.getByLabelText('Heim: 1')).toBeInTheDocument();
    await vorspulen(1);
    expect(screen.queryByLabelText('Heim: 1')).not.toBeInTheDocument();
    expect(screen.getByText(/Gruppe A/)).toBeInTheDocument();
    await vorspulen(14_999);
    expect(screen.queryByText('Bäckerei Maier')).not.toBeInTheDocument();
    await vorspulen(1);
    expect(screen.getByText('Bäckerei Maier')).toBeInTheDocument();
  });

  // @ZM-074: Soll (it.fails) und grüner Bestand-Zwilling.
  it.fails('@ZM-074 1. Halbzeit: Live-Spiel bleibt zwei Minuten stehen', async () => {
    await starte(monitorTurnier(buildTournament({ sponsors: [FIXTURE_SPONSOR] }), programm()));
    await vorspulen(120_000);
    expect(screen.getByLabelText('Heim: 1')).toBeInTheDocument();
  });

  it('Bestand: Live-Folie wechselt trotz laufendem Spiel 7 nach 15 s auf die Tabelle (1. Halbzeit)', async () => {
    await starte(monitorTurnier(buildTournament({ sponsors: [FIXTURE_SPONSOR] }), programm()));
    await vorspulen(15_000);
    expect(screen.queryByLabelText('Heim: 1')).not.toBeInTheDocument();
    expect(screen.getByText(/Gruppe A/)).toBeInTheDocument();
  });

  // @ZM-075: Der Poll liefert Spiel 9 als laufend. Soll: Live-Folie mit Spiel 9 direkt nach dem Poll.
  const folienTabelleLive = () => [slide('standings', { groupId: 'A' }), slide('live', { fieldId: 'field-1' })];
  const vorAnpfiff = () => spiele({ 'match-7': { matchStatus: 'finished', scoreA: 2, scoreB: 1 } });
  const nachAnpfiff = () => spiele({ 'match-7': { matchStatus: 'finished', scoreA: 2, scoreB: 1 }, 'match-9': { matchStatus: 'running' } });

  it.fails('@ZM-075 Anpfiff: Monitor zeigt nach dem Poll das Live-Spiel 9', async () => {
    const folien = folienTabelleLive();
    await starte(monitorTurnier(buildTournament({ matches: vorAnpfiff() }), folien));
    supabaseGet.mockResolvedValue(monitorTurnier(buildTournament({ matches: nachAnpfiff() }), folien));
    await vorspulen(5_000);
    expect(screen.getByText('Kickers West')).toBeInTheDocument();
  });

  it('Bestand: nach dem Poll mit laufendem Spiel 9 bleibt die Tabelle stehen, bis der Takt wechselt', async () => {
    const folien = folienTabelleLive();
    await starte(monitorTurnier(buildTournament({ matches: vorAnpfiff() }), folien));
    supabaseGet.mockResolvedValue(monitorTurnier(buildTournament({ matches: nachAnpfiff() }), folien));
    await vorspulen(5_000);
    expect(screen.queryByText('Kickers West')).not.toBeInTheDocument();
    expect(screen.getByText(/Gruppe A/)).toBeInTheDocument();
    await vorspulen(15_000);
    expect(screen.getByText('Kickers West')).toBeInTheDocument();
  });

  // @ZM-077: Abpfiff mit 2:1 – Soll: die Live-Folie zeigt das Endergebnis.
  const folienLive = () => [slide('live', { fieldId: 'field-1' }), slide('standings', { groupId: 'A' })];
  const nachAbpfiff = () => spiele({ 'match-7': { matchStatus: 'finished', scoreA: 2, scoreB: 1 } });

  it.fails('@ZM-077 Abpfiff: Live-Folie zeigt das Endergebnis 2:1 nach dem Poll', async () => {
    const folien = folienLive();
    await starte(monitorTurnier(buildTournament(), folien));
    supabaseGet.mockResolvedValue(monitorTurnier(buildTournament({ matches: nachAbpfiff() }), folien));
    await vorspulen(5_000);
    expect(screen.getByLabelText('Heim: 2')).toBeInTheDocument();
  });

  it('Bestand: nach dem Abpfiff zeigt die Live-Folie „Nächstes Spiel“ statt des Endergebnisses', async () => {
    const folien = folienLive();
    await starte(monitorTurnier(buildTournament(), folien));
    supabaseGet.mockResolvedValue(monitorTurnier(buildTournament({ matches: nachAbpfiff() }), folien));
    await vorspulen(5_000);
    expect(screen.queryByLabelText('Heim: 2')).not.toBeInTheDocument();
    expect(screen.getByText('Nächstes Spiel')).toBeInTheDocument();
  });

  // @ZM-122: Erstes Spiel auf Feld 1 um 13:00, Stand 12:45 – die Live-Folie darf nicht erscheinen.
  const ersterSpielUm13 = () => buildTournament({
    matches: spiele({
      'match-7': { field: 2 },
      'match-9': { scheduledTime: new Date('2026-10-10T13:00:00') },
    }),
  });

  it.fails('@ZM-122 erstes Spiel 13:00: Feld-1-Monitor überspringt die Live-Folie', async () => {
    await starte(monitorTurnier(ersterSpielUm13(), folienLive()));
    expect(screen.queryByText('Nächstes Spiel')).not.toBeInTheDocument();
  });

  it('Bestand: vor dem ersten Spiel auf Feld 1 zeigt die Live-Folie „Nächstes Spiel“ mit TuS Mitte', async () => {
    await starte(monitorTurnier(ersterSpielUm13(), folienLive()));
    expect(screen.getByText('Nächstes Spiel')).toBeInTheDocument();
    expect(screen.getByText('TuS Mitte')).toBeInTheDocument();
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
