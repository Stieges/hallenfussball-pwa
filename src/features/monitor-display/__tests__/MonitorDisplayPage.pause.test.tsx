/**
 * Pause über die Seite (B-16c Fixrunde 1, Spur B): Leertaste hält die Folie an, Fortsetzen startet
 * eine volle Anzeigedauer. Dazu die Seitenzuordnung der Spielplan-Zeile (B-16d1 Lücke: Seite A links,
 * Seite B rechts). Eigene Datei, damit die eingefrorenen a-Dateien unverändert bleiben.
 * Jeder Poll liefert einen strukturellen Klon (wie SupabaseRepository.get), die Zeit läuft in Schritten.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import type { GoalEventInfo } from '../../../hooks/useLiveMatches';
import type { Tournament } from '../../../types/tournament';
import { attachMonitor, buildTournament, slide, withMatch, withMonitor } from './monitorFixture';

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

function monitorTurnier(): Tournament {
  return attachMonitor(buildTournament(), withMonitor({
    slides: [slide('custom-text', { headline: 'Folie A' }), slide('custom-text', { headline: 'Folie B' })],
  }));
}

/** Jeder Poll liefert einen strukturellen Klon, so wie SupabaseRepository.get neue Objekte baut. */
function liefere(data: Tournament): void {
  supabaseGet.mockImplementation(async () => structuredClone(data));
}

async function vorspulen(ms: number): Promise<void> {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

/** Spult in 1-s-Schritten vor, damit zwischen Polls und Timern gerendert wird. */
async function vorspulenInSchritten(ms: number): Promise<void> {
  for (let i = 0; i < ms / 1_000; i++) { await vorspulen(1_000); }
}

beforeEach(() => {
  vi.clearAllMocks();
  live.goal = null;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('MonitorDisplayPage — Pause über die Leertaste (B-16c Fixrunde, Fake-Timer)', () => {
  it('Leertaste bei 5 s hält Folie A an; Fortsetzen zeigt B genau nach einer vollen Dauer (15 s)', async () => {
    liefere(monitorTurnier());
    localGet.mockResolvedValue(null);
    render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
    await vorspulen(0);
    expect(screen.getByText('Folie A')).toBeInTheDocument();

    await vorspulenInSchritten(5_000);
    fireEvent.keyDown(window, { key: ' ' });
    await vorspulenInSchritten(600_000);
    expect(screen.getByText('Folie A')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: ' ' });
    await vorspulenInSchritten(14_000);
    expect(screen.getByText('Folie A')).toBeInTheDocument();
    await vorspulen(999);
    expect(screen.getByText('Folie A')).toBeInTheDocument();
    await vorspulen(1);
    expect(screen.getByText('Folie B')).toBeInTheDocument();
  });

  it('Spielplan-Zeile: Seite A links, Seite B rechts (Feld 1: FC Nord 1:0 SV Süd)', async () => {
    liefere(attachMonitor(buildTournament(), withMonitor({ slides: [slide('schedule-field', { fieldId: 'field-1' })] })));
    localGet.mockResolvedValue(null);
    render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
    await vorspulen(0);
    expect(screen.getByText('FC Nord').parentElement?.textContent).toBe('FC Nord1:0SV Süd');
  });
});

describe('MonitorDisplayPage — Heim/Gast der Live-Folie und nächstes Spiel (B-16d1 Fixliste 1)', () => {
  it('Live-Folie Feld 1 mit laufendem Spiel 7: FC Nord (Heim) steht vor SV Süd (Gast)', async () => {
    liefere(attachMonitor(buildTournament(), withMonitor({ slides: [slide('live', { fieldId: 'field-1' })] })));
    localGet.mockResolvedValue(null);
    const { container } = render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
    await vorspulen(0);
    const text = container.textContent ?? '';
    expect(text.indexOf('FC Nord')).toBeGreaterThanOrEqual(0);
    expect(text.indexOf('FC Nord')).toBeLessThan(text.indexOf('SV Süd'));
  });

  it('Folie „nächstes Spiel“ Feld 1 nach Ende von Spiel 7: TuS Mitte steht vor Kickers West', async () => {
    liefere(attachMonitor(
      buildTournament({ matches: withMatch('match-7', { matchStatus: 'finished' }) }),
      withMonitor({ slides: [slide('live', { fieldId: 'field-1' })] }),
    ));
    localGet.mockResolvedValue(null);
    const { container } = render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
    await vorspulen(0);
    const text = container.textContent ?? '';
    expect(text).toContain('Nächstes Spiel');
    expect(text.indexOf('TuS Mitte')).toBeGreaterThanOrEqual(0);
    expect(text.indexOf('TuS Mitte')).toBeLessThan(text.indexOf('Kickers West'));
  });
});
