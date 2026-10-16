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
import de from '../../../i18n/locales/de/monitor.json';
import en from '../../../i18n/locales/en/monitor.json';
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

vi.unmock('i18next'); vi.unmock('react-i18next'); // B-41: echte DE-Texte, siehe src/test/realDeI18n.ts
await (await import('../../../test/realDeI18n')).initRealDeI18n();

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
    expect(screen.getByText('Nächste Spiele')).toBeInTheDocument();
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
    expect(screen.getByText('Keine weiteren Spiele')).toBeInTheDocument();
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
    expect(screen.getByText('Nächste Spiele')).toBeInTheDocument();
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

  it('ohne Kindermodus: „Erster Gruppe A“ und „Zweiter Gruppe B“ stehen da', async () => {
    await starte(monitorTurnier(spaeter(false), [slide('next-matches', { matchCount: 1 })]));
    expect(zeilen()).toHaveLength(1);
    expect(screen.getByText('Erster Gruppe A')).toBeInTheDocument();
    expect(screen.getByText('Zweiter Gruppe B')).toBeInTheDocument();
  });

  it('mit Kindermodus: tournament:slot.undecided statt Platzhalter, keine Ziffern eines Ergebnisses', async () => {
    await starte(monitorTurnier(spaeter(true), [slide('next-matches', { matchCount: 1 })]));
    expect(zeilen()).toHaveLength(1);
    expect(screen.queryByText('Erster Gruppe A')).toBeNull();
    expect(within(zeilen()[0]).getAllByText('noch offen')).toHaveLength(2);
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
  // Feld 1 ohne laufendes Spiel: Spiele 7 und 9 beendet, das früheste offene Spiel ist HF1 (Erster Gruppe A).
  const feldEins = (hide: boolean) => buildTournament({
    hideScoresForPublic: hide,
    matches: withPlayoffs().map(m => (m.id === 'match-7' || m.id === 'match-9' ? { ...m, matchStatus: 'finished' as const, scoreA: 1, scoreB: 0 } : m)),
  });

  it('ohne Kindermodus: „Nächstes Spiel“ nennt „Erster Gruppe A“', () => {
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
    expect(screen.getByText('Erster Gruppe A')).toBeInTheDocument();
  });

  it('mit Kindermodus: beide offenen Plätze zeigen tournament:slot.undecided, kein „Erster Gruppe A“', () => {
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
    expect(screen.queryByText('Erster Gruppe A')).toBeNull();
    expect(screen.getAllByText('noch offen')).toHaveLength(2);
  });
});

describe('@W2A-031 Kindermodus an der Spielplan-Folie: offener Platz zeigt „noch offen“, nie einen Tabellenplatz', () => {
  // Feld 1: HF1 (Erster Gruppe A) steht in der Liste; ohne Kindermodus die Herkunft, mit Kindermodus „noch offen“.
  const spielplan = (hide: boolean) => render(
    <ScheduleFieldSlide
      slide={slide('schedule-field', { fieldId: 'field-1' })}
      tournament={buildTournament({ hideScoresForPublic: hide, matches: withPlayoffs() })}
      theme="dark"
      style={{}}
    />,
  );

  it('ohne Kindermodus: die Spielplan-Folie nennt „Erster Gruppe A“', () => {
    spielplan(false);
    expect(screen.getByText('Erster Gruppe A')).toBeInTheDocument();
  });

  it('mit Kindermodus: offener Platz zeigt tournament:slot.undecided, kein „Erster Gruppe A“', () => {
    spielplan(true);
    expect(screen.queryByText('Erster Gruppe A')).toBeNull();
    expect(screen.getAllByText('noch offen').length).toBeGreaterThanOrEqual(2);
  });
});

describe('@ZM-071 Zuschauer-QR: Programm-Folie mit Überschrift „Ergebnisse aufs Handy“ und QR zur Zuschauer-Seite', () => {
  it('Programm qr-code zeigt die Überschrift und den QR mit der Zuschauer-Adresse', async () => {
    await starte(monitorTurnier(buildTournament(), [slide('qr-code'), slide('custom-text', { headline: 'Danach' })]));
    expect(screen.getByText('Ergebnisse aufs Handy')).toBeInTheDocument();
    expect(screen.getByTestId('qr-code').getAttribute('data-value')).toContain('/#/live/ABC123');
  });

  it('Gegenbeispiel: nicht öffentlich → keine QR-Folie, keine Verwaltungs-Adresse, die nächste Folie läuft', async () => {
    await starte(monitorTurnier(buildTournament({ isPublic: false }), [slide('qr-code'), slide('custom-text', { headline: 'Danach' })]));
    expect(screen.queryByTestId('qr-code')).toBeNull();
    expect(screen.queryByText('Ergebnisse aufs Handy')).toBeNull();
    expect(document.body.innerHTML).not.toContain('/#/tournament/');
    expect(screen.getByText('Danach')).toBeInTheDocument();
  });
});

describe('@ZM-130 Zeile 1: Zuschauer-QR ohne eigene Dauer nimmt den Monitor-Standard (20 s)', () => {
  it('QR-Folie zwischen zwei Folien: bei 19 999 ms noch QR, bei 20 000 ms die nächste Folie', async () => {
    await starte(monitorTurnier(buildTournament(), [
      slide('custom-text', { headline: 'Vorher' }, 20),
      slide('qr-code', {}, null),
      slide('custom-text', { headline: 'Danach' }, 20),
    ], { defaultSlideDuration: 20 }));
    await vorspulenInSchritten(20_000);
    expect(screen.getByTestId('qr-code')).toBeInTheDocument();
    await vorspulenInSchritten(19_999);
    expect(screen.getByTestId('qr-code')).toBeInTheDocument();
    expect(screen.queryByText('Danach')).toBeNull();
    await vorspulenInSchritten(1);
    expect(screen.getByText('Danach')).toBeInTheDocument();
  });
});

describe('B-16f4 Texte: „Ergebnisse aufs Handy“ (DE wörtlich, EN vorhanden)', () => {
  it('monitor.json DE enthält den Satz wörtlich, EN hat den Schlüssel', () => {
    expect(de.slides.qr.headline).toBe('Ergebnisse aufs Handy');
    expect(en.slides.qr.headline).toBe('Results on your phone');
  });
});
