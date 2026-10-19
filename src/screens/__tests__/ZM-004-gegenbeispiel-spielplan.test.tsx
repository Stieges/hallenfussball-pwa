/**
 * @ZM-004 Gegenbeispiel (Nachtest NT1, B-13): Gruppentabellen aus – der Spielplan und der Stand
 * von Spiel 7 bleiben sichtbar.
 *
 * Gegeben Olli hat „Gruppentabellen“ für Zuschauer ausgeschaltet, alle anderen Schalter stehen auf der Vorbelegung
 * Wenn Mama Petra die Zuschauer-Seite ansieht, während Spiel 7 läuft
 * Dann sieht sie den Spielplan und den Stand von Spiel 7 (weiter sichtbar)
 *
 * Der Befund zur nicht sichtbaren Tabelle steht in LiveViewScreen.scenarios.test.tsx (it.fails).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { generateFullSchedule } from '../../core/generators';
import { buildLiveViewTournament, SHARE_CODE } from './liveViewFixture';

const { supabaseGet, localGet } = vi.hoisted(() => ({
  supabaseGet: vi.fn(),
  localGet: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));
vi.mock('../../core/repositories/SupabaseRepository', () => ({
  SupabaseRepository: vi.fn(function SupabaseRepository() { return { getByShareCode: supabaseGet }; }),
}));
vi.mock('../../core/repositories/LocalStorageRepository', () => ({
  LocalStorageRepository: vi.fn(function LocalStorageRepository() { return { getByShareCode: localGet }; }),
}));

import { LiveViewScreen } from '../LiveViewScreen';
import { RepositoryProvider } from '../../core/contexts/RepositoryContext';

vi.unmock('i18next'); vi.unmock('react-i18next');
await (await import('../../test/realDeI18n')).initRealDeI18n();

describe('@ZM-004 Gegenbeispiel: ohne Gruppentabellen bleibt der Spielplan mit Spiel 7 sichtbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('@ZM-004 Mama Petra sieht bei ausgeschalteten Tabellen Spiel 7 als laufend mit Stand 1:0 und den Spielplan', async () => {
    const t = buildLiveViewTournament({ hideRankingsForPublic: true });
    const m7 = generateFullSchedule(t).allMatches.find((m) => m.matchNumber === 7);
    expect(m7).toBeDefined();
    supabaseGet.mockResolvedValue(t);
    localGet.mockResolvedValue(null);

    const { container } = render(
      <RepositoryProvider user={null}>
        <MemoryRouter initialEntries={[`/live/${SHARE_CODE}`]}>
          <LiveViewScreen shareCode={SHARE_CODE} />
        </MemoryRouter>
      </RepositoryProvider>
    );
    await screen.findAllByRole('heading', { level: 1, name: 'Hallencup Nord' });

    // Spielplan vorhanden (Gruppenspiele), Spiel 7 mit Paarung und Stand 1:0
    expect(container.querySelector('.group-stage-schedule')).not.toBeNull();
    expect(screen.getAllByText(m7!.homeTeam).length).toBeGreaterThan(0);
    expect(screen.getAllByText('1:0').length).toBeGreaterThan(0);
    for (const circle of container.querySelectorAll(`[data-testid="match-circle-${m7!.id}"]`)) {
      expect(circle).toHaveAttribute('data-match-status', 'running');
    }
  });
});
