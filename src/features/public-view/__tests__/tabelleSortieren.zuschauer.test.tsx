/**
 * Task 5 „Tabellen sortieren“, Zuschauer-Seite: Reiter „Tabelle“ ist sortierbar (@TS-001, @TS-020), mit den echten deutschen
 * Texten der geklonten Anzeige-Instanz (`anzeigeSprache`); bei ausgeschalteter Tabelle oder Kindermodus wird `ts` ignoriert
 * (@TS-013); der Spielplan-Reiter zeigt keine Sortierköpfe. Gemockt nur die Datenquellen wie `hideScoresStandings.test.tsx`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Tournament } from '../../../types/tournament';
import { initRealDeI18n } from '../../../test/realDeI18n';
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
// Mit Supabase liest die Seite über die Server-Funktion (Adapter (b)), ohne Supabase über getByShareCode (Adapter (a)).
// Diese Datei prüft die Anzeige mit Daten aus den Repository-Mocks und legt deshalb den Weg ohne Supabase fest (Adapter (a)).
vi.mock('../defaultPublicSource', async () => {
  const { createLegacyPublicSource } = await import('../legacyPublicSource');
  return { defaultPublicTournamentSource: createLegacyPublicSource() };
});

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

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


describe('Zuschauer-Seite: Tabellen sortieren', () => {
  beforeEach(() => {
    supabaseGet.mockReset();
    localGet.mockReset();
    localStorage.clear();
  });

  it('@TS-020 Reiter „Tabelle“: Gruppe A nach Tore per Adresse sortiert, Gruppe B nicht; deutsche Texte der Bausteine', async () => {
    const { container } = await renderWith(buildLiveViewTournament(), '?tab=standings&ts=gA.tore');
    expect(screen.getByTestId('sort-picker-gA')).toBeInTheDocument();
    expect(screen.getByTestId('sort-reset-gA')).toHaveTextContent('Nach Platzierung');
    expect(screen.queryByTestId('sort-reset-gB')).toBeNull();
    expect(screen.getAllByText('Sortieren nach …').length).toBe(2);
    const desktops = container.querySelectorAll<HTMLElement>('.desktop-view');
    expect(within(desktops[0]).getByTestId('sort-head-gA-tore')).toHaveAccessibleName('Tore, meiste zuerst sortiert');
    expect(within(desktops[1]).getByTestId('sort-head-gB-tore')).toHaveAccessibleName('Tore');
  });

  it('@TS-001 ohne Adresse und Gerätewert: Platzierung, keine Taste „Nach Platzierung“', async () => {
    await renderWith(buildLiveViewTournament(), '?tab=standings');
    expect(screen.queryByTestId('sort-reset-gA')).toBeNull();
    expect(screen.getAllByTestId('sort-head-gA-platz')[0]).toHaveAttribute('data-sorted', 'true');
  });

  it('@TS-013 hideRankingsForPublic mit ?ts=gA.tore: Hinweis statt Tabelle, keine Sortierung', async () => {
    await renderWith(buildLiveViewTournament({ hideRankingsForPublic: true }), '?tab=standings&ts=gA.tore');
    expect(screen.getByTestId('public-standings-hidden-icon')).toBeInTheDocument();
    expect(document.querySelector('[data-testid^="sort-"]')).toBeNull();
  });

  it('@TS-013 Kindermodus mit ?ts=gA.tore: Reiter wird auf den Spielplan umgeleitet, keine Sortierung', async () => {
    const { container } = await renderWith(buildLiveViewTournament({ hideScoresForPublic: true }), '?tab=standings&ts=gA.tore');
    expect(container.querySelector('[data-testid^="sort-"]')).toBeNull();
    expect(container.querySelector('.standings-table')).toBeNull();
  });

  it('Spielplan-Reiter „Spiele“ zeigt die Gruppentabellen ohne Sortierköpfe, auch mit ?ts=', async () => {
    const { container } = await renderWith(buildLiveViewTournament(), '?ts=gA.tore');
    expect(container.querySelectorAll('.standings-table').length).toBeGreaterThan(0);
    expect(container.querySelector('[data-testid^="sort-"]')).toBeNull();
  });
});
