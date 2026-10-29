/**
 * @ZM-180 „Ein beendetes Spiel bleibt auf jeder Anzeige beendet, auch wenn ein älterer Stand nachkommt“ – Hallenmonitor
 * Feld 1 über den echten Lade-Weg (Hook + Datenquelle; gefälscht sind nur Server, Turnierkopie und Engine-Speicher):
 * Gegeben Spiel 7 ist mit 2:1 beendet, wenn danach noch ein älterer Stand ankommt (1:1, läuft), dann zeigt der Monitor
 * weiter „Endstand 2:1“, und die Tabelle rechnet weiter mit 2:1. Wege: lokale Quelle (Turnierkopie + Engine-Kopien,
 * Prüfbericht L2b/L4) und späte Server-Antwort.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import type { MatchCopy } from '../../../core/match/client';
import { createMonitorSource } from '../monitorDataSource';
import { useMonitorDisplayData } from '../useMonitorDisplayData';
import { calculateStandings } from '../../../utils/calculations';
import { attachMonitor, buildTournament, slide, withMatch, withMonitor } from './monitorFixture';
import { BIS_1_1, kopie, NORD, SUED, ZUM_2_1_BEENDET } from './zm180Kopien';

const { displayGet, localGet, engine } = vi.hoisted(() => ({
  displayGet: vi.fn(),
  localGet: vi.fn(),
  engine: { copies: [] as MatchCopy[] },
}));

vi.mock('../../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: null }));
vi.mock('../../../core/realtime/displaySignal', () => ({ subscribeDisplaySignal: () => () => undefined }));
vi.mock('../../../core/repositories/SupabaseRepository', () => ({
  SupabaseRepository: vi.fn(function SupabaseRepository() { return { getForDisplay: displayGet }; }),
}));
vi.mock('../../../core/repositories/LocalStorageRepository', () => ({
  LocalStorageRepository: vi.fn(function LocalStorageRepository() { return { get: localGet }; }),
}));
vi.mock('../../../core/match/client/LocalMatchStore', () => ({
  LocalMatchStore: vi.fn(function LocalMatchStore() { return { all: () => Promise.resolve(engine.copies) }; }),
}));

vi.unmock('i18next'); vi.unmock('react-i18next');
await (await import('../../../test/realDeI18n')).initRealDeI18n();

const TAKT_MS = 2_000;
const target = { tournamentId: 'tour-1', monitorId: 'mon-1' };

/** Hallencup Nord mit Monitor „Feld 1“; Spiel 7 in der gewünschten Lage. `changeRevision` = Kopie stammt aus der Cloud. */
function turnier(spiel7: { scoreA?: number; scoreB?: number; matchStatus: 'scheduled' | 'running' | 'finished' }, cloudKopie = true): Tournament {
  const t = attachMonitor(buildTournament({ matches: withMatch('match-7', spiel7) }), withMonitor({ slides: [slide('live', { fieldId: 'field-1' })] }));
  return cloudKopie ? { ...t, changeRevision: 3 } : t;
}
const ENDSTAND = turnier({ scoreA: 2, scoreB: 1, matchStatus: 'finished' });
const AELTER = turnier({ scoreA: 1, scoreB: 1, matchStatus: 'running' });
const full = (t: Tournament, version: number) => ({ kind: 'full', version, serverNowMs: 0, tournament: t });

/** Rendert den Monitor und protokolliert jeden sichtbaren Stand von Spiel 7 (z. B. „2:1 finished“). */
function monitor() {
  const gesehen: string[] = [];
  const source = createMonitorSource(target.tournamentId, target.monitorId);
  const hook = renderHook(() => {
    const data = useMonitorDisplayData(source, target, () => TAKT_MS);
    const m = data.tournament?.matches.find((x) => x.id === 'match-7');
    const stand = m === undefined ? null : `${m.scoreA ?? '-'}:${m.scoreB ?? '-'} ${m.matchStatus ?? ''}`;
    if (stand !== null && gesehen[gesehen.length - 1] !== stand) { gesehen.push(stand); }
    return data;
  });
  return { ...hook, gesehen };
}

/** „Nie 1:1 läuft nach Endstand 2:1“: nach dem ersten „2:1 finished“ nur noch „2:1 finished“. */
function nieZurueck(gesehen: string[]): void {
  const ab = gesehen.indexOf('2:1 finished');
  expect(ab).toBeGreaterThanOrEqual(0);
  expect(gesehen.slice(ab)).toEqual(['2:1 finished']);
}

describe('@ZM-180 Hallenmonitor Feld 1: ein beendetes Spiel bleibt beendet', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    displayGet.mockReset();
    localGet.mockReset();
    engine.copies = [];
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('@ZM-180 beendet 2:1, danach älterer Stand aus der lokalen Quelle (1:1 läuft) -> bleibt 2:1; Tabelle zählt Spiel 7 mit 2:1', async () => {
    displayGet.mockResolvedValueOnce(full(ENDSTAND, 10)).mockRejectedValue(new Error('Netz weg'));
    localGet.mockResolvedValue(AELTER);
    engine.copies = [kopie('olli', BIS_1_1)];
    const { result, gesehen } = monitor();
    await act(async () => { await vi.advanceTimersByTimeAsync(3 * TAKT_MS + 100); });
    expect(displayGet.mock.calls.length).toBeGreaterThanOrEqual(3);
    nieZurueck(gesehen);

    const t = result.current.tournament;
    expect(t).not.toBeNull();
    const tabelle = t === null ? [] : calculateStandings(t.teams, t.matches, t, 'A');
    // FC Nord: Spiel 1 (2:1 gegen SC Ost) + Spiel 7 (2:1 gegen SV Süd); SV Süd: nur Spiel 7 (1:2).
    expect(tabelle.find((s) => s.team.id === NORD)).toMatchObject({ played: 2, points: 6, goalsFor: 4, goalsAgainst: 2 });
    expect(tabelle.find((s) => s.team.id === SUED)).toMatchObject({ played: 1, points: 0, goalsFor: 1, goalsAgainst: 2 });
  });

  it('@ZM-180 beendet 2:1, danach späte Antwort eines älteren Abrufs (1:1 läuft, nach der Zeitgrenze) -> bleibt 2:1', async () => {
    let spaet: (v: unknown) => void = () => undefined;
    displayGet
      .mockResolvedValueOnce(full(ENDSTAND, 10))
      .mockReturnValueOnce(new Promise((resolve) => { spaet = resolve; }))
      .mockResolvedValue(full(ENDSTAND, 10));
    localGet.mockResolvedValue(AELTER);
    const { gesehen } = monitor();
    await act(async () => { await vi.advanceTimersByTimeAsync(TAKT_MS + 4_100); }); // Abruf 2 hängt, Zeitgrenze 4 s
    await act(async () => { spaet(full(AELTER, 9)); await vi.advanceTimersByTimeAsync(2 * TAKT_MS); });
    nieZurueck(gesehen);
  });

  it('@ZM-180 L2b: Monitor startet ohne Server, Abpfiff wartet im Ausgang; dann Cloud 1:1 läuft -> nie „1:1 läuft“ nach „Endstand 2:1“', async () => {
    displayGet
      .mockRejectedValueOnce(new Error('Netz weg'))
      .mockResolvedValueOnce(full(AELTER, 9)) // Server hat den Abpfiff noch nicht
      .mockResolvedValue(full(ENDSTAND, 10)); // Ausgang gesendet
    localGet.mockResolvedValue(AELTER);
    engine.copies = [kopie('olli', BIS_1_1, { pending: ZUM_2_1_BEENDET })];
    const { gesehen } = monitor();
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(gesehen).toEqual(['1:1 running']); // lokal nur Bestätigtes
    await act(async () => { await vi.advanceTimersByTimeAsync(2 * TAKT_MS); });
    nieZurueck(gesehen);
    expect(gesehen).toEqual(['1:1 running', '2:1 finished']);
  });

  it('@ZM-179 Gegenprobe: Turnier nur auf diesem Gerät (Server kennt es nicht) -> wartender Abpfiff sofort als 2:1 beendet', async () => {
    displayGet.mockResolvedValue({ kind: 'not-found' });
    localGet.mockResolvedValue(turnier({ matchStatus: 'scheduled' }, false));
    engine.copies = [kopie('olli', BIS_1_1, { pending: ZUM_2_1_BEENDET })];
    const { gesehen } = monitor();
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(gesehen).toEqual(['2:1 finished']);
  });
});
