/**
 * A-36c Fixrunde 1 (A3): die öffentliche Seite `/public/:id` liest Sichtbarkeit nur aus den Regeln der Ansicht (`viewRules`).
 * @ZM-005 / W2A-031: im Kindermodus gibt es keine Gruppentabelle (keine Punkte, kein Platz); Gegenbeispiel: normaler Modus
 * zeigt die Tabellen. Gemockt sind nur die Datenquellen; die Texte kommen aus der echten DE-i18n.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Tournament } from '../../types/tournament';
import { buildLiveViewTournament } from './liveViewFixture';

const { supabaseGet, localGet } = vi.hoisted(() => ({ supabaseGet: vi.fn(), localGet: vi.fn() }));
vi.mock('../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock('../../core/repositories/SupabaseRepository', () => ({
  SupabaseRepository: vi.fn(function SupabaseRepository() { return { get: supabaseGet, getByShareCode: supabaseGet }; }),
}));
vi.mock('../../core/repositories/LocalStorageRepository', () => ({
  LocalStorageRepository: vi.fn(function LocalStorageRepository() { return { get: localGet }; }),
}));

import { PublicTournamentViewScreen } from '../PublicTournamentViewScreen';
import { RepositoryProvider } from '../../core/contexts/RepositoryContext';

vi.unmock('i18next'); vi.unmock('react-i18next');
await (await import('../../test/realDeI18n')).initRealDeI18n();

async function zeige(tournament: Tournament): Promise<HTMLElement> {
  supabaseGet.mockResolvedValue(tournament);
  localGet.mockResolvedValue(null);
  const { container } = render(
    <RepositoryProvider user={null}>
      <MemoryRouter><PublicTournamentViewScreen tournamentId={tournament.id} /></MemoryRouter>
    </RepositoryProvider>,
  );
  await screen.findAllByRole('heading', { level: 1, name: tournament.title });
  return container;
}

describe('@ZM-005 W2A-031 öffentliche Seite /public/:id: Tabellen nur nach den Regeln der Ansicht', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('@ZM-005 Kindermodus: keine Gruppentabelle, kein Stand im Spielplan', async () => {
    const c = await zeige(buildLiveViewTournament({ hideScoresForPublic: true }));
    expect(c.querySelector('.standings-table')).toBeNull();
    expect(c.textContent).not.toContain('2:0');
  });

  it('@ZM-005 Tabellen aus (ohne Kindermodus): keine Gruppentabelle', async () => {
    const c = await zeige(buildLiveViewTournament({ hideRankingsForPublic: true }));
    expect(c.querySelector('.standings-table')).toBeNull();
  });

  it('Gegenbeispiel: normaler Modus zeigt die Gruppentabellen mit Stand', async () => {
    const c = await zeige(buildLiveViewTournament());
    expect(c.querySelectorAll('.standings-table').length).toBeGreaterThan(0);
    expect(c.textContent).toContain('2:0');
  });
});
