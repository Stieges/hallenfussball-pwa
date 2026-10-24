/**
 * B-27 Zuschauer-Seite: groß die neue Uhrzeit, klein „ursprünglich hh:mm“ (@ZP-004, @ZP-005, @ZP-049) und „voraussichtlich“
 * bei K.-o.-Spielen (@ZM-105). Gemockt nur die Datenquellen; die Screen-Logik ist echt (wie hideScoresStandings.test.tsx).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Match, Tournament } from '../../../types/tournament';
import { buildLiveViewTournament, SHARE_CODE } from '../../../screens/__tests__/liveViewFixture';

const { supabaseGet, localGet } = vi.hoisted(() => ({ supabaseGet: vi.fn(), localGet: vi.fn() }));

vi.unmock('i18next');
vi.unmock('react-i18next');
vi.mock('../../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { from: vi.fn(), rpc: vi.fn() } }));
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

import { LiveViewScreen } from '../../../screens/LiveViewScreen';
import { RepositoryProvider } from '../../../core/contexts/RepositoryContext';
import { initRealDeI18n } from '../../../test/realDeI18n';

await initRealDeI18n();

const at = (date: string, hhmm: string): Date => new Date(`${date}T${hhmm}:00`);

/** Spiel 2 steht um `shown`, Spiel 3 um `third`; `originals` nennt die Uhrzeit beim ersten Anpfiff je Spielnummer. */
function turnier(opts: { shown: string; original?: string }): { tournament: Tournament; spiel2: Match; finale: Match } {
  const base = buildLiveViewTournament();
  const date = base.date.slice(0, 10);
  const matches = base.matches.map((m): Match => {
    if (m.matchNumber === 2) {
      return { ...m, scheduledTime: at(date, opts.shown), ...(opts.original === undefined ? {} : { originalStart: at(date, opts.original) }) };
    }
    if (m.matchNumber === 15) {
      return { ...m, scheduledTime: at(date, '17:05'), originalStart: at(date, '16:55') };
    }
    if (m.matchNumber === 13) {
      return { ...m, scheduledTime: at(date, '16:15') };
    }
    return { ...m, scheduledTime: at(date, '14:00') };
  });
  const tournament = { ...base, matches };
  return { tournament, spiel2: matches.find((m) => m.matchNumber === 2)!, finale: matches.find((m) => m.matchNumber === 15)! };
}

async function zeigen(tournament: Tournament) {
  supabaseGet.mockResolvedValue(tournament);
  localGet.mockResolvedValue(null);
  const view = render(
    <RepositoryProvider user={null}>
      <MemoryRouter initialEntries={[`/live/${SHARE_CODE}`]}>
        <LiveViewScreen shareCode={SHARE_CODE} />
      </MemoryRouter>
    </RepositoryProvider>
  );
  await screen.findAllByRole('heading', { level: 1, name: tournament.title });
  return view;
}

const original = (id: string): HTMLElement[] => screen.queryAllByTestId(`match-original-${id}`);

describe('B-27 Zuschauer-Seite: ursprüngliche Uhrzeit', () => {
  beforeEach(() => {
    supabaseGet.mockReset();
    localGet.mockReset();
    localStorage.clear();
  });

  it('@ZP-004 Spiel 2 steht um 15:40 mit „ursprünglich 15:30“', async () => {
    const { tournament, spiel2 } = turnier({ shown: '15:40', original: '15:30' });
    await zeigen(tournament);
    expect(original(spiel2.id).length).toBeGreaterThan(0);
    expect(original(spiel2.id)[0]).toHaveTextContent('ursprünglich 15:30');
  });

  it('@ZP-005 Gegenbeispiel: stimmt die Uhrzeit wieder überein, steht kein „ursprünglich“ dabei', async () => {
    const { tournament, spiel2 } = turnier({ shown: '15:30', original: '15:30' });
    await zeigen(tournament);
    expect(original(spiel2.id)).toEqual([]);
    expect(screen.queryAllByText(/ursprünglich 15:30/)).toEqual([]);
  });

  it('@ZP-049 Gegenbeispiel: Planung vor dem ersten Anpfiff (keine ursprüngliche Uhrzeit) zeigt bei keinem Spiel „ursprünglich“', async () => {
    const { tournament } = turnier({ shown: '15:40' });
    const ohne = { ...tournament, matches: tournament.matches.map((m) => ({ ...m, originalStart: undefined })) };
    const { container } = await zeigen(ohne);
    expect(container.textContent).not.toMatch(/ursprünglich/);
  });

  it('@ZM-105 K.-o.-Uhrzeiten stehen als „voraussichtlich“, auch mit ihrer ursprünglichen; Gruppenspiele nicht', async () => {
    const { tournament, spiel2, finale } = turnier({ shown: '15:40', original: '15:30' });
    await zeigen(tournament);
    expect(screen.queryAllByTestId(`match-tentative-${finale.id}`)[0]).toHaveTextContent('voraussichtlich');
    expect(original(finale.id)[0]).toHaveTextContent('ursprünglich 16:55');
    expect(screen.queryAllByTestId(`match-tentative-${spiel2.id}`)).toEqual([]);
  });
});
