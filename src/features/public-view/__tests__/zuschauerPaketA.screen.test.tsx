/**
 * Zuschauer-Paket A, Seiten-Ebene: Reiter „Tabellen“ nach dem Abschluss (@ET-044, C-ZUSCHAUER-TABELLE-NEBEN-ENDSTAND, Durchsicht Z11) und
 * Abrufe des Endstands (@ZM-193, Durchsicht Z20: vor dem Abschluss kein Endstand im Takt). Gemockt nur die Datenquellen und die Antwort von `public_final_standings`; die Seite ist echt.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Tournament } from '../../../types/tournament';
import { buildLiveViewTournament, SHARE_CODE, TEAM_IDS } from '../../../screens/__tests__/liveViewFixture';

const { supabaseGet, localGet, rpc } = vi.hoisted(() => ({ supabaseGet: vi.fn(), localGet: vi.fn(), rpc: vi.fn() }));

vi.mock('../../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { from: vi.fn(), rpc } }));
vi.mock('../../../core/repositories/SupabaseRepository', () => ({
  SupabaseRepository: vi.fn(function SupabaseRepository() { return { getByShareCode: supabaseGet }; }),
}));
vi.mock('../../../core/repositories/LocalStorageRepository', () => ({
  LocalStorageRepository: vi.fn(function LocalStorageRepository() { return { getByShareCode: localGet }; }),
}));
vi.mock('../defaultPublicSource', async () => {
  const { createLegacyPublicSource } = await import('../legacyPublicSource');
  return { defaultPublicTournamentSource: createLegacyPublicSource() };
});
await initRealDeI18n();

import { LiveViewScreen } from '../../../screens/LiveViewScreen';
import { RepositoryProvider } from '../../../core/contexts/RepositoryContext';

/** Gespeicherte Reihenfolge, bewusst NICHT die der live gerechneten Tabelle (Punkte 99 beim Letzten: nie neu gerechnet). */
const ORDER = [TEAM_IDS.tal, TEAM_IDS.berg, TEAM_IDS.hafen, TEAM_IDS.mitte, TEAM_IDS.ost, TEAM_IDS.west, TEAM_IDS.sued, TEAM_IDS.nord];
const NAMES = ['TuS Tal', 'SV Berg', 'FC Hafen', 'VfL Mitte', 'SC Ost', 'TSV West', 'SV Süd', 'FC Nord'];

function stored(): unknown {
  return {
    status: 'final', finishedAt: '2026-11-28T12:10:00+00:00',
    standings: {
      format: 1, appVersion: 'alt', computedAt: '2026-11-28T13:10:00+01:00',
      ranking: ORDER.map((teamId, i) => ({
        place: i + 1, teamId, teamName: NAMES[i], origin: { kind: 'groupPlace', group: i < 4 ? 'A' : 'B', place: (i % 4) + 1 },
        tableValues: { games: 3, goalsFor: 9 - i, goalsAgainst: 3, goalDiff: 6 - i, points: 99 - i },
      })),
    },
  };
}

const finished = (): Tournament => ({ ...buildLiveViewTournament(), lifecycleStatus: 'finished' });

/** Wer auf einen Abruf des Endstands wartet (@ZM-193); die gemockte Antwort meldet jeden Aufruf von `public_final_standings`. */
const abrufHoerer = new Set<() => void>();

function rpcAntwort(reply: unknown): (name: string) => Promise<unknown> {
  return (name) => {
    if (name === 'public_final_standings') {
      abrufHoerer.forEach((hoerer) => { hoerer(); });
    }
    return Promise.resolve(name === 'public_final_standings' ? { data: reply, error: null } : { data: null, error: { message: 'x' } });
  };
}

async function renderAt(tournament: Tournament, reply: unknown, query: string) {
  supabaseGet.mockResolvedValue(tournament);
  localGet.mockResolvedValue(null);
  rpc.mockImplementation(rpcAntwort(reply));
  const view = render(
    <RepositoryProvider user={null}>
      <MemoryRouter initialEntries={[`/live/${SHARE_CODE}${query}`]}><LiveViewScreen shareCode={SHARE_CODE} /></MemoryRouter>
    </RepositoryProvider>,
  );
  await screen.findAllByRole('heading', { level: 1, name: tournament.title });
  return view;
}

const placeNames = (): string[] => within(screen.getByTestId('final-standings-list')).getAllByTestId('final-standing-row')
  .map((row) => within(row).getByText(/^(FC|SV|TSV|SC|VfL|TuS)/).textContent ?? '');

describe('Z11 @ET-044 Reiter „Tabellen“ nach dem Abschluss = Endstand', () => {
  beforeEach(() => { supabaseGet.mockReset(); localGet.mockReset(); rpc.mockReset(); localStorage.clear(); });

  it('nach dem Abschluss stehen im Reiter „Tabellen“ dieselben Teams auf denselben Plätzen wie im Endstand der „Spiele“ – nicht live gerechnet', async () => {
    const spiele = await renderAt(finished(), stored(), '');
    await screen.findByTestId('final-standings-list');
    const imSpielplan = placeNames();
    expect(imSpielplan).toEqual(NAMES);
    spiele.unmount();

    const { container } = await renderAt(finished(), stored(), '?tab=standings');
    await screen.findByTestId('final-standings-list');
    expect(placeNames()).toEqual(imSpielplan);
    expect(container.querySelector('.standings-table')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Spielplan' })).toBeNull();
  });

  it('Gegenbeispiel: vor dem Abschluss (Server „none“) zeigt der Reiter „Tabellen“ weiter die Gruppentabellen', async () => {
    const { container } = await renderAt(buildLiveViewTournament(), { status: 'none' }, '?tab=standings');
    await waitFor(() => { expect(rpc).toHaveBeenCalledWith('public_final_standings', { p_share_code: SHARE_CODE }); });
    expect(container.querySelector('.standings-table')).not.toBeNull();
    expect(screen.queryByTestId('final-standings-list')).toBeNull();
  });
});

describe('@ZM-193 Abrufe des Endstands auf der Zuschauer-Seite', () => {
  const finalAbrufe = (): number => rpc.mock.calls.filter(([name]) => name === 'public_final_standings').length;
  const takt = async (): Promise<void> => {
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
  };
  /**
   * Wartet auf den Abruf selbst, nicht auf eine DOM-Änderung (C-ZM193-UNIT-WACKELT): mit gefälschtem `setInterval` prüft das
   * `waitFor` der Testing Library nur noch nach DOM-Änderungen nach. Der Abruf beim Öffnen läuft in Reacts Effekt-Aufgabe
   * (Scheduler, `setImmediate`); unter Last ist `findBy…` schon vorher fertig, und die Antwort „none“ ändert am DOM nichts.
   */
  const bisAbrufe = async (anzahl: number): Promise<void> => {
    await act(async () => {
      await new Promise<void>((resolve, reject) => {
        const frist = setTimeout(() => {
          abrufHoerer.delete(pruefe);
          reject(new Error(`Endstand ${finalAbrufe()}× statt ${anzahl}× erfragt`));
        }, 2000);
        function pruefe(): void {
          if (finalAbrufe() >= anzahl) {
            clearTimeout(frist);
            abrufHoerer.delete(pruefe);
            resolve();
          }
        }
        abrufHoerer.add(pruefe);
        pruefe();
      });
    });
  };

  beforeEach(() => {
    supabaseGet.mockReset(); localGet.mockReset(); rpc.mockReset(); localStorage.clear();
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  });
  afterEach(() => { vi.useRealTimers(); });

  it('läuft das Turnier, wird der Endstand beim Öffnen einmal erfragt und danach nicht mehr im Takt', async () => {
    await renderAt({ ...buildLiveViewTournament(), lifecycleStatus: 'fixed' }, { status: 'none' }, '');
    await bisAbrufe(1);
    expect(finalAbrufe()).toBe(1);
    await takt(); await takt(); await takt();
    expect(finalAbrufe()).toBe(1);
  });

  it('@ZM-193 wird das Turnier abgeschlossen, während die Seite offen ist, steht der Endstand spätestens einen Takt danach da', async () => {
    await renderAt({ ...buildLiveViewTournament(), lifecycleStatus: 'fixed' }, { status: 'none' }, '');
    await bisAbrufe(1);
    expect(finalAbrufe()).toBe(1);
    expect(screen.queryByTestId('final-standings-list')).toBeNull();
    // Abschluss auf dem Server: Spielplan meldet „abgeschlossen“, der Endstand liegt vor
    supabaseGet.mockResolvedValue(finished());
    rpc.mockImplementation(rpcAntwort(stored()));
    // Der heutige Leseweg (Adapter a) hat keinen eigenen Takt für den Spielplan: die Seite holt ihn bei Rückkehr in den Vordergrund
    for (const state of ['hidden', 'visible']) {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
      await act(async () => { document.dispatchEvent(new Event('visibilitychange')); await Promise.resolve(); });
    }
    await takt();
    expect(await screen.findByTestId('final-standings-list')).toBeInTheDocument();
    expect(placeNames()).toEqual(NAMES);
  });

  it('Gegenbeispiel: nach dem Abschluss wird der Endstand mit jedem Takt erfragt', async () => {
    await renderAt(finished(), { status: 'none' }, '');
    await bisAbrufe(1);
    expect(finalAbrufe()).toBe(1);
    await takt(); await takt();
    await bisAbrufe(3);
    expect(finalAbrufe()).toBe(3);
  });
});
