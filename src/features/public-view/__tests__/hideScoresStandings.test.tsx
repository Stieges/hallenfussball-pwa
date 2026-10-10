/**
 * W2A-031 „Kindermodus blendet öffentlich überall aus“ – Zuschauer-Seite bei hideScoresForPublic.
 * Keine Stände, keine Tabellen, kein Tabellenplatz, kein Tabellen-Tab. Paarung, Uhrzeit bleiben.
 * Gemockt nur die Datenquellen (wie LiveViewScreen.scenarios.test.tsx); die Screen-Logik ist echt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Tournament } from '../../../types/tournament';
import { buildLiveViewTournament, SHARE_CODE } from '../../../screens/__tests__/liveViewFixture';

const { supabaseGet, localGet } = vi.hoisted(() => ({
  supabaseGet: vi.fn(),
  localGet: vi.fn(),
}));

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));
vi.mock('../../../core/repositories/SupabaseRepository', () => ({
  SupabaseRepository: vi.fn(function SupabaseRepository() { return { getByShareCode: supabaseGet }; }),
}));
vi.mock('../../../core/repositories/LocalStorageRepository', () => ({
  LocalStorageRepository: vi.fn(function LocalStorageRepository() { return { getByShareCode: localGet }; }),
}));

import { LiveViewScreen } from '../../../screens/LiveViewScreen';
import { RepositoryProvider } from '../../../core/contexts/RepositoryContext';

function renderScreen(query = '') {
  return render(
    <RepositoryProvider user={null}>
      <MemoryRouter initialEntries={[`/live/${SHARE_CODE}${query}`]}>
        <LiveViewScreen shareCode={SHARE_CODE} />
      </MemoryRouter>
    </RepositoryProvider>
  );
}

async function renderWith(tournament: Tournament, query = '') {
  supabaseGet.mockResolvedValue(tournament);
  localGet.mockResolvedValue(null);
  const view = renderScreen(query);
  await screen.findAllByRole('heading', { level: 1, name: tournament.title });
  return view;
}

describe('W2A-031 Zuschauer-Seite: hideScoresForPublic blendet Stände, Tabellen und Tab aus', () => {
  beforeEach(() => {
    supabaseGet.mockReset();
    localGet.mockReset();
    localStorage.clear();
  });

  it('Pflicht: ohne Tabellen-Tab, ohne Punkte und ohne Tabellenplatz; Paarung und Uhrzeit bleiben', async () => {
    // Spiel 1 ist beendet (2:0) – der Stand darf nirgends erscheinen
    const t = buildLiveViewTournament({ hideScoresForPublic: true });
    const { container } = await renderWith(t);

    // Kein Tabellen-Tab in der Navigation
    const nav = screen.getByRole('navigation', { name: 'Public Navigation' });
    expect(within(nav).queryByRole('button', { name: 'Tabellen' })).toBeNull();
    expect(within(nav).getByRole('button', { name: 'Spiele' })).toBeInTheDocument();

    // Keine Gruppentabellen-Zeilen, kein Stand
    expect(container.querySelector('.standings-table')).toBeNull();
    expect(container.querySelector('.group-tables-container')).toBeNull();
    expect(container.textContent).not.toMatch(/\b2\s*:\s*0\b/);
    expect(container.textContent).not.toMatch(/\b1\s*:\s*0\b/);

    // Paarung und Uhrzeit bleiben sichtbar
    expect(screen.getAllByText(/FC Nord/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/SV Süd/).length).toBeGreaterThan(0);
    expect(container.textContent).toMatch(/\d{1,2}:\d{2}/);
  });

  it('Pflicht: Direktaufruf ?tab=standings zeigt den Spielplan, keine Tabelle', async () => {
    const t = buildLiveViewTournament({ hideScoresForPublic: true });
    const { container } = await renderWith(t, '?tab=standings');

    const nav = screen.getByRole('navigation', { name: 'Public Navigation' });
    expect(within(nav).getByRole('button', { name: 'Spiele' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).queryByRole('button', { name: 'Tabellen' })).toBeNull();
    expect(container.querySelector('.standings-table')).toBeNull();
    expect(container.querySelector('.group-tables-container')).toBeNull();
    expect(screen.getAllByText(/FC Nord/).length).toBeGreaterThan(0);
  });

  it('Fix 2 Gegenbeispiel: ohne Kindermodus steht die Gruppentabelle im Spielplan-Tab', async () => {
    const t = buildLiveViewTournament({ hideScoresForPublic: false, hideRankingsForPublic: false });
    const { container } = await renderWith(t);

    expect(container.querySelector('.group-tables-container')).not.toBeNull();
    expect(container.querySelectorAll('.standings-table').length).toBeGreaterThan(0);
  });

  it('Gegenbeispiel: ohne hideScoresForPublic bleibt der Tabellen-Tab mit Tabellen', async () => {
    const t = buildLiveViewTournament({ hideScoresForPublic: false, hideRankingsForPublic: false });
    const { container } = await renderWith(t, '?tab=standings');

    const nav = screen.getByRole('navigation', { name: 'Public Navigation' });
    expect(within(nav).getByRole('button', { name: 'Tabellen' })).toHaveAttribute('aria-current', 'page');
    expect(container.querySelectorAll('.standings-table').length).toBeGreaterThan(0);
  });
});
