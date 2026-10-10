/**
 * B-16e1 – Takt-Gegenprobe (C-MON-TAKT-STEHT): Jeder Poll liefert einen strukturellen Klon, die Zeit
 * läuft in 1-s-Schritten. Ohne laufendes Spiel wechselt die Folie bei 15/30/45/60 s, auch wenn bei jedem
 * Poll neue Objekte kommen. Ein Poll mit geänderten Spieldaten (ohne Spielregel) verschiebt den Takt nicht.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import type { MonitorSlide } from '../../../types/monitor';
import type { Tournament } from '../../../types/tournament';
import {
  attachMonitor, buildTournament, slide, withMonitor,
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

function monitorTurnier(tournament: Tournament, slides: MonitorSlide[]): Tournament {
  return attachMonitor(tournament, withMonitor({ slides }));
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

describe('MonitorDisplayPage — Takt-Gegenprobe (C-MON-TAKT-STEHT, Klon je Poll, 1-s-Schritte)', () => {
  it('ohne laufendes Spiel wechselt die Folie bei 15/30/45/60 s, obwohl jeder Poll neue Objekte liefert', async () => {
    const folien = [
      slide('custom-text', { headline: 'Folie A' }),
      slide('custom-text', { headline: 'Folie B' }),
    ];
    await starte(monitorTurnier(buildTournament(), folien));
    const reihenfolge: string[] = [];
    for (let t = 0; t < 60_000; t += 1_000) {
      await vorspulenInSchritten(1_000);
      const aktuell = screen.queryByText('Folie A') ? 'A' : screen.queryByText('Folie B') ? 'B' : '?';
      if (reihenfolge.at(-1) !== aktuell) { reihenfolge.push(aktuell); }
    }
    expect(reihenfolge).toEqual(['A', 'B', 'A', 'B', 'A']);
  });

  it('Poll mit neuen Objekten gleicher Daten verschiebt den Wechsel nicht (weiterhin 15 s)', async () => {
    const folienA = slide('custom-text', { headline: 'Folie A' });
    const folienB = slide('custom-text', { headline: 'Folie B' });
    await starte(monitorTurnier(buildTournament(), [folienA, folienB]));
    await vorspulenInSchritten(9_000);
    liefere(monitorTurnier(buildTournament(), [folienA, folienB]));
    await vorspulenInSchritten(5_999);
    expect(screen.getByText('Folie A')).toBeInTheDocument();
    await vorspulenInSchritten(1_000);
    expect(screen.getByText('Folie B')).toBeInTheDocument();
  });
});
