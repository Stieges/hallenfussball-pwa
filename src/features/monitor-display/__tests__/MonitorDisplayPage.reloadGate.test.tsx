/**
 * B-19b (@ZM-124, @ZM-128, @ME-012, @ME-032) – Pflichttest „echter Weg“: Monitor-Seite mit echtem Takt,
 * Poll-Klonen und Fake-Timern. Eine neue App-Version lädt nur beim Folienwechsel zu einer Folie ohne laufendes
 * Spiel neu; eine unlesbare Antwort lädt sofort neu, ohne das letzte Bild zu verlieren.
 */
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RepositoryError, UnreadableResponseError } from '../../../core/errors';
import { hasOpenModalDialog, UPDATE_POLL_MS } from '../../../lib/swIdle';
import { __resetSwForTests, setupSwAutoReload } from '../../../lib/swRegistration';
import {
  __fireNeedRefresh,
  __fireRegisteredSW,
  registerSWMock,
  updateSWMock,
} from '../../../test/mocks/virtual-pwa-register';
import type { MonitorSlide } from '../../../types/monitor';
import type { Tournament } from '../../../types/tournament';
import {
  attachMonitor, buildTournament, slide, withMatch, withMonitor,
} from './monitorFixture';

/** Folienprogramm Feld 1: Live-Spiel (Anhalten laut Parameter), Tabelle Gruppe A. */
const programmLive = (pauseRotationDuringMatch: boolean): MonitorSlide[] => [
  slide('live', { fieldId: 'field-1', pauseRotationDuringMatch }),
  slide('standings', { groupId: 'A' }),
];

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

function monitorTurnier(matches: Tournament['matches'] | undefined, slides: MonitorSlide[]): Tournament {
  return attachMonitor(buildTournament(matches ? { matches } : {}), withMonitor({ slides }));
}

/** Jeder Poll liefert einen strukturellen Klon, so wie SupabaseRepository.get neue Objekte baut. */
function liefere(data: Tournament): void {
  supabaseGet.mockImplementation(async () => structuredClone(data));
}

async function vorspulen(ms: number, schritt = 1_000): Promise<void> {
  let rest = ms;
  while (rest > 0) {
    const s = Math.min(schritt, rest);
    await act(async () => { await vi.advanceTimersByTimeAsync(s); });
    rest -= s;
  }
}

/** Die SW-Schicht wie in der App aufgesetzt: Leerlauf-Prüfung ja, Neuladen über updateSW(true). */
function setupSw(): void {
  setupSwAutoReload({
    registerSW: registerSWMock,
    showToast: vi.fn(),
    updatingMessage: () => 'Updating…',
    isIdle: async () => true,
    hasOpenModalDialog: () => hasOpenModalDialog(document),
    showUpdateNotice: vi.fn(),
    reload: vi.fn(),
  });
}

async function starte(data: Tournament): Promise<void> {
  liefere(data);
  localGet.mockResolvedValue(null);
  render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
}

/** Spiel 7 beendet (2:1), Poll-Klon. */
const spiel7Beendet = () => withMatch('match-7', { matchStatus: 'finished', scoreA: 2, scoreB: 1 });

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  setupSw();
});

afterEach(() => {
  __resetSwForTests();
  vi.useRealTimers();
  Reflect.deleteProperty(document, 'visibilityState');
});

describe('MonitorDisplayPage — Neulade-Tor (B-19b, @ZM-124, @ZM-128, @ME-012, @ME-032)', () => {
  it('@ME-012 / @ZM-124 Zeile 1: Spiel 7 läuft auf der Live-Folie, neue Version → 10 min kein Neuladen', async () => {
    await starte(monitorTurnier(undefined, programmLive(true)));
    act(() => { __fireNeedRefresh(); });
    await vorspulen(10 * 60_000, 5_000);
    expect(updateSWMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Heim: 1')).toBeInTheDocument();
  });

  it('Pflicht echter Weg (@ZM-124 Zeile 1): Spiel 7 läuft → 10 min kein Neuladen; Spiel 7 beendet, Folienwechsel → genau ein Neuladen', async () => {
    await starte(monitorTurnier(undefined, programmLive(true)));
    act(() => { __fireNeedRefresh(); });
    await vorspulen(10 * 60_000, 5_000);
    expect(updateSWMock).not.toHaveBeenCalled();

    liefere(monitorTurnier(spiel7Beendet().map(m => m), programmLive(true)));
    await vorspulen(20_000);
    expect(updateSWMock).not.toHaveBeenCalled();
    await vorspulen(20_000);
    expect(updateSWMock).toHaveBeenCalledTimes(1);
    expect(updateSWMock).toHaveBeenCalledWith(true);
    await vorspulen(60_000, 5_000);
    expect(updateSWMock).toHaveBeenCalledTimes(1);
  });

  it('Gegenbeispiel „fast richtig“: Spiel pausiert (Unterbrechung) ist nicht vorbei → 10 min kein Neuladen', async () => {
    await starte(monitorTurnier(withMatch('match-7', { matchStatus: 'paused' }), programmLive(true)));
    act(() => { __fireNeedRefresh(); });
    await vorspulen(10 * 60_000, 5_000);
    expect(updateSWMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Heim: 1')).toBeInTheDocument();
  });

  it('@ZM-128: Anhalten im Spiel abgeschaltet → Wechsel zu Tabelle bei laufendem Spiel lädt neu, vorher nicht', async () => {
    await starte(monitorTurnier(undefined, programmLive(false)));
    act(() => { __fireNeedRefresh(); });
    await vorspulen(14_000);
    expect(updateSWMock).not.toHaveBeenCalled();
    await vorspulen(1_000 + 2_000);
    expect(updateSWMock).toHaveBeenCalledTimes(1);
    expect(updateSWMock).toHaveBeenCalledWith(true);
  });

  // W3 (@ZM-124 Zeile 2, @ME-012): Die neue Version kommt, während die Tabelle steht. Schon vorher gab es
  // Wechsel (15 s, 30 s). Der Zähler gehört zur Version: erst der nächste Wechsel zur QR-Folie (45 s) lädt neu.
  it('@ZM-124 Zeile 2 / @ME-012: Version kommt auf der Tabelle; neu erst beim nächsten Wechsel (45 s), vorher nie', async () => {
    await starte(monitorTurnier(undefined, [slide('standings', { groupId: 'A' }), slide('qr-code', {})]));
    await vorspulen(35_000);
    act(() => { __fireNeedRefresh(); });
    await vorspulen(9_000);
    expect(updateSWMock).not.toHaveBeenCalled();
    await vorspulen(4_000);
    expect(updateSWMock).toHaveBeenCalledTimes(1);
  });

  it('@ME-012 Versions-Check: 30-min-Check während laufendem Spiel → 0 Neuladen; visibilitychange → 0; erst Wechsel → 1', async () => {
    await starte(monitorTurnier(undefined, programmLive(true)));
    const update = vi.fn(async () => { __fireNeedRefresh(); });
    __fireRegisteredSW({ update } as unknown as ServiceWorkerRegistration);
    // Über den Tick hinaus, damit eine geplante Neulade-Verzögerung (2 s) Zeit zum Feuern hätte.
    await vorspulen(UPDATE_POLL_MS + 10_000, 5_000);
    expect(update).toHaveBeenCalled();
    expect(updateSWMock).not.toHaveBeenCalled();

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await vorspulen(1_000);
    expect(updateSWMock).not.toHaveBeenCalled();

    liefere(monitorTurnier(spiel7Beendet(), programmLive(true)));
    await vorspulen(70_000, 1_000);
    expect(updateSWMock).toHaveBeenCalledTimes(1);
  });

  it('@ME-032: unlesbare Antwort → Bild bleibt, kein Fehlertext, neue Version wird sofort geladen (auch bei laufendem Spiel)', async () => {
    const update = vi.fn(async () => undefined);
    __fireRegisteredSW({ update } as unknown as ServiceWorkerRegistration);
    await starte(monitorTurnier(undefined, programmLive(true)));
    supabaseGet.mockRejectedValueOnce(new UnreadableResponseError('get', new TypeError('Antwort-Format unbekannt')));
    await vorspulen(5_000);
    expect(update).toHaveBeenCalled();
    expect(screen.getByLabelText('Heim: 1')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(updateSWMock).not.toHaveBeenCalled();

    act(() => { __fireNeedRefresh(); });
    expect(updateSWMock).toHaveBeenCalledWith(true);
  });

  it('Rückfall ohne Netz bleibt unverändert: Netzfehler → lokale Kopie, kein unlesbar-Befund, kein Neuladen', async () => {
    const update = vi.fn(async () => undefined);
    __fireRegisteredSW({ update } as unknown as ServiceWorkerRegistration);
    supabaseGet.mockRejectedValue(new RepositoryError('get', 'Failed to fetch'));
    localGet.mockResolvedValue(monitorTurnier(undefined, programmLive(true)));
    render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
    await vorspulen(10_000);
    expect(screen.getByLabelText('Heim: 1')).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
    expect(updateSWMock).not.toHaveBeenCalled();
  });
});

// Hilfstyp für die Folienliste (Lesbarkeit der Fälle oben).
export type { MonitorSlide };
