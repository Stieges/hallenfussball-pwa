/**
 * B-16f2 – Folien „Nächste Spiele“ und Live-Folie (@ZM-071, @ZM-078, @ZM-089, C-MON-NAECHSTES-UNSORTIERT).
 * Harness wie der Takt-Test: struktureller Klon je Poll, Zeit in 1-s-Schritten, echter Takt über die Seite.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, within } from '@testing-library/react';
import type { MonitorSlide } from '../../../types/monitor';
import type { Tournament } from '../../../types/tournament';
import type { MatchStatus } from '../../../types/tournament';
import { PERFORMANCE_PROFILES } from '../../../types/monitor';
import { LiveSlide } from '../slides/LiveSlide';
import { ScheduleFieldSlide } from '../slides/ScheduleFieldSlide';
import {
  attachMonitor, buildTournament, FIXTURE_SPONSOR, slide, withMonitor, withPlayoffs, withScheduledTimes,
} from './monitorFixture';

const { supabaseGet, localGet } = vi.hoisted(() => ({
  supabaseGet: vi.fn(),
  localGet: vi.fn(),
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
    getMatchById: () => undefined, lastGoalEvent: null, clearLastGoalEvent: vi.fn(),
    lastCardEvent: null, clearLastCardEvent: vi.fn(), calculateElapsedSeconds: () => 0,
  }),
}));

import { MonitorDisplayPage } from '../MonitorDisplayPage';

function monitorTurnier(tournament: Tournament, slides: MonitorSlide[], overrides: Parameters<typeof withMonitor>[0] = {}): Tournament {
  return attachMonitor(tournament, withMonitor({ slides, ...overrides }));
}

/** Jeder Poll liefert einen strukturellen Klon, so wie SupabaseRepository.get neue Objekte baut. */
function liefere(data: Tournament): void {
  supabaseGet.mockImplementation(async () => structuredClone(data));
}

async function vorspulenInSchritten(ms: number, schritt = 1_000): Promise<void> {
  let rest = ms;
  while (rest > 0) {
    const s = Math.min(schritt, rest);
    await act(async () => { await vi.advanceTimersByTimeAsync(s); });
    rest -= s;
  }
}

async function starte(data: Tournament): Promise<void> {
  liefere(data);
  localGet.mockResolvedValue(null);
  render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
});

afterEach(() => {
  vi.useRealTimers();
});

const zeilen = () => screen.queryAllByTestId('monitor-match-row');

describe('@ZM-071 Nächste Spiele: Zeilen über alle Felder, Uhrzeit und Feld, nie ein Ergebnis', () => {
  it('zeigt Spiel 8 (14:20, Feld 2) und Spiel 9 (14:40, Feld 1); laufendes und beendetes Spiel fehlen', async () => {
    await starte(monitorTurnier(buildTournament({ matches: withScheduledTimes() }), [slide('next-matches', { matchCount: 3 })]));
    expect(screen.getByText('monitor:slides.nextMatches.title')).toBeInTheDocument();
    expect(zeilen()).toHaveLength(2);
    expect(zeilen()[0]).toHaveTextContent('14:20');
    expect(zeilen()[0]).toHaveTextContent('Feld 2');
    expect(zeilen()[0]).toHaveTextContent('DJK Berg');
    expect(zeilen()[1]).toHaveTextContent('14:40');
    expect(zeilen()[1]).toHaveTextContent('Feld 1');
    expect(zeilen()[1]).toHaveTextContent('Kickers West');
    expect(screen.queryByText('FC Nord')).toBeNull();
  });

  it('Gegenbeispiel: ein unterbrochenes (paused) Spiel erscheint nie als nächstes', async () => {
    const pausiert = withScheduledTimes().map(m => (m.id === 'match-8' ? { ...m, matchStatus: 'paused' as unknown as MatchStatus } : m));
    await starte(monitorTurnier(buildTournament({ matches: pausiert }), [slide('next-matches', { matchCount: 3 })]));
    expect(zeilen()).toHaveLength(1);
    expect(zeilen()[0]).toHaveTextContent('Kickers West');
  });

  it('keine offenen Spiele: neutraler Satz statt leerer Folie (R-f1)', async () => {
    const alleFertig = withScheduledTimes().map(m => ({ ...m, matchStatus: 'finished' as const }));
    await starte(monitorTurnier(buildTournament({ matches: alleFertig }), [slide('next-matches', { matchCount: 3 })]));
    expect(screen.getByText('monitor:slides.nextMatches.none')).toBeInTheDocument();
    expect(zeilen()).toHaveLength(0);
  });
});

describe('@ZM-078 Nächste Spiele nach Abpfiff: Spiel 7 fällt aus der Liste; Spiel 8 läuft', () => {
  it('Sponsor (15 s) → Nächste Spiele; Poll bei 5 s meldet Spiel 7 beendet 2:1; ab 15 s ohne Spiel 7', async () => {
    const folien = [slide('sponsor', { sponsorId: 'sp-1' }), slide('next-matches', { matchCount: 3 })];
    const laeuft = withScheduledTimes().map(m => (m.id === 'match-8' ? { ...m, matchStatus: 'running' as const } : m));
    await starte(monitorTurnier(buildTournament({ matches: laeuft, sponsors: [FIXTURE_SPONSOR] }), folien));
    expect(screen.getByText('Bäckerei Maier')).toBeInTheDocument();
    await vorspulenInSchritten(4_000);
    const beendet = laeuft.map(m => (m.id === 'match-7' ? { ...m, matchStatus: 'finished' as const, scoreA: 2, scoreB: 1 } : m));
    liefere(monitorTurnier(buildTournament({ matches: beendet, sponsors: [FIXTURE_SPONSOR] }), folien));
    await vorspulenInSchritten(10_999);
    expect(screen.getByText('Bäckerei Maier')).toBeInTheDocument();
    await vorspulenInSchritten(1);
    expect(screen.queryByText('Bäckerei Maier')).toBeNull();
    expect(screen.getByText('monitor:slides.nextMatches.title')).toBeInTheDocument();
    expect(screen.queryByText('SV Süd')).toBeNull();
    expect(zeilen()).toHaveLength(1);
    expect(zeilen()[0]).toHaveTextContent('14:40');
    expect(zeilen()[0]).toHaveTextContent('Feld 1');
    expect(zeilen()[0]).toHaveTextContent('Kickers West');
  });
});

describe('@ZM-089 Kindermodus: offenes Halbfinale als nächstes Spiel', () => {
  // Gruppenspiele 8 und 9 beendet, Spiel 7 läuft nicht mehr: das früheste offene Spiel ist HF1.
  const spaeter = (hide: boolean) => buildTournament({
    hideScoresForPublic: hide,
    matches: withPlayoffs().map(m => (m.id === 'match-8' || m.id === 'match-9' ? { ...m, matchStatus: 'finished' as const, scoreA: 1, scoreB: 0 } : m)),
  });

  it('ohne Kindermodus: „1. Gruppe A“ und „2. Gruppe B“ stehen da', async () => {
    await starte(monitorTurnier(spaeter(false), [slide('next-matches', { matchCount: 1 })]));
    expect(zeilen()).toHaveLength(1);
    expect(screen.getByText('1. Gruppe A')).toBeInTheDocument();
    expect(screen.getByText('2. Gruppe B')).toBeInTheDocument();
  });

  it('mit Kindermodus: tournament:slot.undecided statt Platzhalter, keine Ziffern eines Ergebnisses', async () => {
    await starte(monitorTurnier(spaeter(true), [slide('next-matches', { matchCount: 1 })]));
    expect(zeilen()).toHaveLength(1);
    expect(screen.queryByText('1. Gruppe A')).toBeNull();
    expect(within(zeilen()[0]).getAllByText('tournament:slot.undecided')).toHaveLength(2);
    expect(screen.queryByText('1:0')).toBeNull();
  });
});

describe('C-MON-NAECHSTES-UNSORTIERT: Live-Folie nimmt das früheste offene Spiel ihres Feldes', () => {
  it('Feld 1 ohne laufendes Spiel, Array mit Platz 3 zuerst → „Nächstes Spiel“ ist Spiel 9 (14:40), nicht Platz 3', () => {
    const beendet = withPlayoffs().map(m => (m.id === 'match-7' ? { ...m, matchStatus: 'finished' as const, scoreA: 2, scoreB: 1 } : m));
    render(
      <LiveSlide
        slide={slide('live', { fieldId: 'field-1' })}
        tournament={buildTournament({ matches: beendet })}
        performanceSettings={PERFORMANCE_PROFILES.high}
        theme="dark"
        style={{}}
      />,
    );
    expect(screen.getByText('Nächstes Spiel')).toBeInTheDocument();
    expect(screen.getByText('Kickers West')).toBeInTheDocument();
    expect(screen.queryByText('Verlierer 1. Halbfinale')).toBeNull();
  });
});

describe('@W2A-031 Kindermodus an der Live-Folie: offener Platz zeigt „noch offen“, nie einen Tabellenplatz', () => {
  // Feld 1 ohne laufendes Spiel: Spiele 7 und 9 beendet, das früheste offene Spiel ist HF1 (group-a-1st).
  const feldEins = (hide: boolean) => buildTournament({
    hideScoresForPublic: hide,
    matches: withPlayoffs().map(m => (m.id === 'match-7' || m.id === 'match-9' ? { ...m, matchStatus: 'finished' as const, scoreA: 1, scoreB: 0 } : m)),
  });

  it('ohne Kindermodus: „Nächstes Spiel“ nennt „1. Gruppe A“', () => {
    render(
      <LiveSlide
        slide={slide('live', { fieldId: 'field-1' })}
        tournament={feldEins(false)}
        performanceSettings={PERFORMANCE_PROFILES.high}
        theme="dark"
        style={{}}
      />,
    );
    expect(screen.getByText('Nächstes Spiel')).toBeInTheDocument();
    expect(screen.getByText('1. Gruppe A')).toBeInTheDocument();
  });

  it('mit Kindermodus: beide offenen Plätze zeigen tournament:slot.undecided, kein „1. Gruppe A“', () => {
    render(
      <LiveSlide
        slide={slide('live', { fieldId: 'field-1' })}
        tournament={feldEins(true)}
        performanceSettings={PERFORMANCE_PROFILES.high}
        theme="dark"
        style={{}}
      />,
    );
    expect(screen.getByText('Nächstes Spiel')).toBeInTheDocument();
    expect(screen.queryByText('1. Gruppe A')).toBeNull();
    expect(screen.getAllByText('tournament:slot.undecided')).toHaveLength(2);
  });
});

describe('@W2A-031 Kindermodus an der Spielplan-Folie: offener Platz zeigt „noch offen“, nie einen Tabellenplatz', () => {
  // Feld 1: HF1 (group-a-1st) steht in der Liste; ohne Kindermodus die Herkunft, mit Kindermodus „noch offen“.
  const spielplan = (hide: boolean) => render(
    <ScheduleFieldSlide
      slide={slide('schedule-field', { fieldId: 'field-1' })}
      tournament={buildTournament({ hideScoresForPublic: hide, matches: withPlayoffs() })}
      theme="dark"
      style={{}}
    />,
  );

  it('ohne Kindermodus: die Spielplan-Folie nennt „1. Gruppe A“', () => {
    spielplan(false);
    expect(screen.getByText('1. Gruppe A')).toBeInTheDocument();
  });

  it('mit Kindermodus: offener Platz zeigt tournament:slot.undecided, kein „1. Gruppe A“', () => {
    spielplan(true);
    expect(screen.queryByText('1. Gruppe A')).toBeNull();
    expect(screen.getAllByText('tournament:slot.undecided').length).toBeGreaterThanOrEqual(2);
  });
});
