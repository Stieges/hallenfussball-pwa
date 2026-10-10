/**
 * Folieninhalte, Tasten und Einblendungen des Monitors — heutiges Verhalten (B-16a1).
 * Keine Produktivdatei wird geändert. Was heute nicht dem Soll entspricht, steht als
 * `it.fails` (Soll) mit grünem „Bestand:“-Zwilling daneben.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import type { CardEventInfo, GoalEventInfo } from '../../../hooks/useLiveMatches';
import type { MonitorSlide } from '../../../types/monitor';
import type { Tournament } from '../../../types/tournament';
import {
  attachMonitor, buildTournament, FIXTURE_SPONSOR, slide, withMatch, withMonitor,
} from './monitorFixture';

const { supabaseGet, localGet, live } = vi.hoisted(() => ({
  supabaseGet: vi.fn(),
  localGet: vi.fn(),
  live: {
    goal: null as GoalEventInfo | null,
    card: null as CardEventInfo | null,
    clearGoal: vi.fn(),
    clearCard: vi.fn(),
  },
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
// QR-Wert sichtbar machen: die Tests lesen `data-value` statt des SVG-Inhalts.
vi.mock('qrcode.react', async () => {
  const React = await import('react');
  return {
    QRCodeSVG: ({ value }: { value: string }) => React.createElement('svg', { 'data-testid': 'qr-code', 'data-value': value }),
  };
});
// Die Einblendungen kommen aus `live` (veränderbar), nicht aus einem Zustand des Hooks.
vi.mock('../../../hooks/useLiveMatches', () => ({
  useLiveMatches: () => ({
    liveMatches: new Map(),
    runningMatches: [],
    pausedMatches: [],
    runningMatchIds: new Set<string>(),
    getMatchById: () => undefined,
    lastGoalEvent: live.goal,
    clearLastGoalEvent: live.clearGoal,
    lastCardEvent: live.card,
    clearLastCardEvent: live.clearCard,
    calculateElapsedSeconds: () => 0,
  }),
}));

import { MonitorDisplayPage } from '../MonitorDisplayPage';

/** Punkte-Zelle (letzte Spalte) der Tabellenzeile eines Teams. */
function pointsOf(teamName: string): string | null {
  return screen.getByText(teamName).parentElement?.lastElementChild?.textContent ?? null;
}

/** Lädt den Monitor über die Cloud-Quelle und wartet, bis die Seite steht. */
async function renderMonitor(tournament: Tournament, slides: MonitorSlide[]) {
  const monitor = withMonitor({ slides });
  supabaseGet.mockResolvedValue(attachMonitor(tournament, monitor));
  localGet.mockResolvedValue(null);
  const onBack = vi.fn();
  render(<MonitorDisplayPage tournamentId={tournament.id} monitorId={monitor.id} onBack={onBack} />);
  await waitFor(() => expect(screen.queryByText('Lade Display...')).not.toBeInTheDocument());
  return { onBack };
}

/** Tabellen-Tests: Spiel 7 läuft noch und zählt sonst mit seinem Zwischenstand (siehe Bestand unten). */
function tabelle(flags: Partial<Tournament> = {}): Tournament {
  return buildTournament({ ...flags, matches: withMatch('match-7', { scoreA: undefined, scoreB: undefined }) });
}

const goalInMatch8: GoalEventInfo = {
  matchId: 'match-8', teamId: 'team-berg', teamName: 'DJK Berg', side: 'home',
  timestamp: 1, newScore: { home: 1, away: 0 },
};

beforeEach(() => {
  vi.clearAllMocks();
  live.goal = null;
  live.card = null;
});

describe('MonitorDisplayPage — Folieninhalt (Bestand)', () => {
  it.each([
    {
      zeile: 'Tabelle einer Gruppe (Gruppe A)',
      run: async () => {
        await renderMonitor(tabelle(), [slide('standings', { groupId: 'A' })]);
        expect(screen.getByText(/Gruppe A/)).toBeInTheDocument();
        expect(pointsOf('FC Nord')).toBe('3');
        expect(pointsOf('SC Ost')).toBe('0');
      },
    },
    {
      zeile: 'Sponsor („Bäckerei Maier“)',
      run: async () => {
        await renderMonitor(buildTournament({ sponsors: [FIXTURE_SPONSOR] }), [slide('sponsor', { sponsorId: 'sp-1' })]);
        expect(screen.getByText('Bäckerei Maier')).toBeInTheDocument();
      },
    },
    {
      zeile: 'Eigener Text („Kuchen in der Pausenhalle“)',
      run: async () => {
        await renderMonitor(buildTournament(), [slide('custom-text', { headline: 'Kuchen in der Pausenhalle' })]);
        expect(screen.getByText('Kuchen in der Pausenhalle')).toBeInTheDocument();
      },
    },
  ])('@ZM-071 $zeile', async ({ run }) => { await run(); });

  it('Bestand: Live-Folie Feld 1 zeigt FC Nord – SV Süd mit 1:0, ohne „1. Halbzeit“', async () => {
    await renderMonitor(buildTournament(), [slide('live', { fieldId: 'field-1' })]);
    expect(screen.getByText('FC Nord')).toBeInTheDocument();
    expect(screen.getByText('SV Süd')).toBeInTheDocument();
    expect(screen.getByLabelText('Heim: 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Gast: 0')).toBeInTheDocument();
    expect(screen.queryByText('1. Halbzeit')).not.toBeInTheDocument();
  });

  it('Bestand: Spielplan-Folie Feld 2 zeigt die Paarungen ohne Uhrzeit', async () => {
    await renderMonitor(buildTournament(), [slide('schedule-field', { fieldId: 'field-2' })]);
    // Nur der Folien-Container: das <style>-Element der Seite enthält Dezimalzahlen (0.95).
    // Kein \b: der Text verkettet Zellen ohne Leerzeichen („SC Ost14:20DJK“). Ergebnisse der
    // Fixture sind einstellig (2:1), ein Treffer hier ist daher eine Uhrzeit.
    const folie = screen.getByText(/Spielplan Feld 2/).parentElement?.textContent ?? '';
    expect(folie).toContain('DJK Berg');
    expect(folie).not.toMatch(/\d{1,2}[:.]\d{2}/);
  });

  it('Bestand: Tabelle zählt das laufende Spiel 7 mit seinem Zwischenstand (FC Nord 6 Punkte)', async () => {
    await renderMonitor(buildTournament(), [slide('standings', { groupId: 'A' })]);
    expect(pointsOf('FC Nord')).toBe('6');
  });

  it('Bestand: QR-Rückfall zeigt die Zuschauer-Adresse, nicht „Ergebnisse aufs Handy“', async () => {
    // Nur nicht darstellbare Folien (Phase 2) → Rückfall auf die Zuschauer-QR-Folie.
    await renderMonitor(buildTournament(), [slide('top-scorers')]); // next-matches seit f2 darstellbar
    expect(screen.getByText(/#\/live\/ABC123/)).toBeInTheDocument();
    expect(screen.queryByText(/Ergebnisse aufs Handy/)).not.toBeInTheDocument();
  });

});

describe('MonitorDisplayPage — Tasten (Bestand)', () => {
  const zweiFolien = () => [
    slide('custom-text', { headline: 'Erste Folie' }),
    slide('custom-text', { headline: 'Zweite Folie' }),
    slide('custom-text', { headline: 'Dritte Folie' }),
  ];

  it('Bestand: ArrowRight springt weiter, ArrowLeft geht zurück und am Anfang auf die letzte Folie', async () => {
    await renderMonitor(buildTournament(), zweiFolien());
    expect(screen.getByText('Erste Folie')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('Zweite Folie')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText('Erste Folie')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText('Dritte Folie')).toBeInTheDocument();
  });

  it('Bestand: Leertaste schaltet den Pausen-Indikator ein und wieder aus', async () => {
    await renderMonitor(buildTournament(), zweiFolien());
    fireEvent.keyDown(window, { key: ' ' });
    expect(screen.getByTestId('monitor-pause-indicator')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: ' ' });
    expect(screen.queryByTestId('monitor-pause-indicator')).not.toBeInTheDocument();
  });

  it('Bestand: Escape ruft onBack genau einmal auf', async () => {
    const { onBack } = await renderMonitor(buildTournament(), zweiFolien());
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('Bestand: Taste c blendet die Cache-Anzeige ein', async () => {
    await renderMonitor(buildTournament(), zweiFolien());
    expect(screen.queryByText(/^\d+s$/)).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'c' });
    expect(screen.getByText(/^\d+s$/)).toBeInTheDocument();
  });
});

describe('MonitorDisplayPage — Einblendungen (Tor)', () => {
  it('@ZM-083 Eingang: Tor in Spiel 8 (DJK Berg) wird im Monitor eingeblendet', async () => {
    live.goal = goalInMatch8;
    await renderMonitor(buildTournament(), [slide('custom-text', { headline: 'Willkommen' })]);
    expect(await screen.findByText('DJK Berg')).toBeInTheDocument();
  });

  it('@ZM-083 Feld 1: Tor auf Feld 2 wird auf dem Feld-1-Monitor nicht eingeblendet', async () => {
    live.goal = goalInMatch8;
    await renderMonitor(buildTournament(), [slide('live', { fieldId: 'field-1' })]);
    // Effekte nach dem Laden flushen, bevor die Einblendung geprüft wird (sonst falsches Grün).
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByText('DJK Berg')).not.toBeInTheDocument();
  });

});

describe('MonitorDisplayPage — Karteneinblendung (@ZM-119, Fake-Timer)', () => {
  // Szenario-Daten: DJK Berg Nr. 4, Spiel 8, Sponsor-Folie „Bäckerei Maier“.
  const gelbeKarte: CardEventInfo = {
    matchId: 'match-8', teamId: 'team-berg', teamName: 'DJK Berg', side: 'home', cardType: 'YELLOW',
    playerNumber: 4, timestamp: 2,
  };

  async function renderMitKarte(): Promise<void> {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    live.card = gelbeKarte;
    const tournament = buildTournament({ sponsors: [FIXTURE_SPONSOR] });
    supabaseGet.mockResolvedValue(attachMonitor(tournament, withMonitor({ slides: [slide('sponsor', { sponsorId: 'sp-1' })] })));
    localGet.mockResolvedValue(null);
    render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByText('DJK Berg')).toBeInTheDocument();
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  // Kein Soll-Anspruch: die Verweildauer 3199/3200 ms steht nicht im Szenario (Review B3).
  it('Bestand: Karte erscheint und verschwindet von selbst (bei 3000 ms), Aufräumen 200 ms später', async () => {
    await renderMitKarte();
    await act(async () => { await vi.advanceTimersByTimeAsync(2999); });
    expect(screen.getByText('DJK Berg')).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(screen.queryByText('DJK Berg')).not.toBeInTheDocument();
    expect(live.clearCard).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(199); });
    expect(live.clearCard).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(live.clearCard).toHaveBeenCalledTimes(1);
  });
});
