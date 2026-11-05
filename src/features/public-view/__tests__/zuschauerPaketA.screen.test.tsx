/**
 * Zuschauer-Paket A, Seiten-Ebene: Reiter „Tabellen“ nach dem Abschluss (@ET-044, C-ZUSCHAUER-TABELLE-NEBEN-ENDSTAND, Durchsicht Z11) und
 * Abrufe des Endstands (Z20; Szenario fehlt: Entwurf C der Durchsicht 2026-11-05 „vor dem Abschluss höchstens eine Server-Funktion je
 * 10 Sekunden“). Gemockt nur die Datenquellen und die Antwort von `public_final_standings`; die Seite ist echt.
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

async function renderAt(tournament: Tournament, reply: unknown, query: string) {
  supabaseGet.mockResolvedValue(tournament);
  localGet.mockResolvedValue(null);
  rpc.mockImplementation((name: string) => Promise.resolve(name === 'public_final_standings' ? { data: reply, error: null } : { data: null, error: { message: 'x' } }));
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

describe('Z20 Abrufe des Endstands auf der Zuschauer-Seite', () => {
  const finalAbrufe = (): number => rpc.mock.calls.filter(([name]) => name === 'public_final_standings').length;
  const takt = async (): Promise<void> => {
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
  };

  beforeEach(() => {
    supabaseGet.mockReset(); localGet.mockReset(); rpc.mockReset(); localStorage.clear();
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  });
  afterEach(() => { vi.useRealTimers(); });

  it('läuft das Turnier, wird der Endstand beim Öffnen einmal erfragt und danach nicht mehr im Takt', async () => {
    await renderAt({ ...buildLiveViewTournament(), lifecycleStatus: 'fixed' }, { status: 'none' }, '');
    await waitFor(() => { expect(finalAbrufe()).toBe(1); });
    await takt(); await takt(); await takt();
    expect(finalAbrufe()).toBe(1);
  });

  it('Gegenbeispiel: nach dem Abschluss wird der Endstand mit jedem Takt erfragt', async () => {
    await renderAt(finished(), { status: 'none' }, '');
    await waitFor(() => { expect(finalAbrufe()).toBe(1); });
    await takt(); await takt();
    await waitFor(() => { expect(finalAbrufe()).toBe(3); });
  });
});
