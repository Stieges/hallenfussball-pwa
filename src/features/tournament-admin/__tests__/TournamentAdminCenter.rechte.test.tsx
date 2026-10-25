/**
 * A-11 Verwaltung (Admin Center) für Tom (Helfer):
 * - @W5-017 „Bearbeiten“: Stammdaten (metadata) und Einstellungen (settings) nicht angeboten (tournamentSettings).
 * - @LZ-022 „die öffentliche Ansicht beenden / auf ‚dauerhaft‘ stellen“: Sichtbarkeit (visibility) nicht angeboten
 *   (manageLifecycle).
 * Statt der Kategorie steht „Ändern nur durch die Turnierleitung“. Gegenbeispiel: Maria (Co-Admin) sieht die Kategorien.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Tournament } from '../../../types/tournament';

vi.unmock('i18next');
vi.unmock('react-i18next');

const role = vi.hoisted(() => ({ current: 'collaborator' }));
vi.mock('../../auth/hooks/useMyTournamentRole', () => ({
  useMyTournamentRole: () => ({ role: role.current, isLoading: false }),
}));
const tournament = { id: 'hallencup-ost', title: 'Hallencup Ost', teams: [], matches: [] } as unknown as Tournament;
const reload = vi.hoisted(() => vi.fn());
vi.mock('../../../hooks/useTournamentManager', () => ({
  useTournamentManager: () => ({
    tournament, handleTournamentUpdate: vi.fn(), applyRemote: vi.fn(), scheduleService: null, loadingError: null, reload,
  }),
}));
vi.mock('../../../hooks/useBreakpoint', () => ({ useBreakpoint: () => ({ isMobile: false }) }));
vi.mock('../components/AdminSidebar', () => ({ AdminSidebar: () => null }));
vi.mock('../components/AdminHeader', () => ({ AdminHeader: () => null }));
vi.mock('../categories/Visibility', () => ({ VisibilityCategory: () => <div data-testid="kategorie-visibility" /> }));
vi.mock('../categories/Metadata', () => ({ MetadataCategory: () => <div data-testid="kategorie-metadata" /> }));
const dashboard = vi.hoisted<{ props: unknown }>(() => ({ props: undefined }));
vi.mock('../categories/Dashboard', () => ({ DashboardCategory: (props: unknown) => { dashboard.props = props; return <div data-testid="kategorie-dashboard" />; } }));
vi.mock('../categories/Settings', () => ({ SettingsCategory: () => <div data-testid="kategorie-settings" /> }));

import { initRealDeI18n } from '../../../test/realDeI18n';
import { ToastProvider } from '../../../components/ui/Toast';
import { TournamentAdminCenter } from '../TournamentAdminCenter';

await initRealDeI18n();

function renderCenter(category: string) {
  render(
    <MemoryRouter><ToastProvider>
      <TournamentAdminCenter tournamentId="hallencup-ost" initialCategory={category} onBackToTournament={vi.fn()} />
    </ToastProvider></MemoryRouter>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('Admin Center – Kategorien nur mit Recht', () => {
  it.each(['metadata', 'settings', 'visibility'])('@W5-017 @LZ-022 Tom: „%s“ nicht angeboten, Hinweis statt Kategorie', async (category) => {
    role.current = 'collaborator';
    renderCenter(category);
    expect(await screen.findByTestId('lead-only-hint')).toHaveTextContent('Ändern nur durch die Turnierleitung');
    expect(screen.queryByTestId(`kategorie-${category}`)).not.toBeInTheDocument();
  });

  it.each(['metadata', 'settings', 'visibility'])('Gegenbeispiel Maria (Co-Admin): „%s“ angeboten', async (category) => {
    role.current = 'co-admin';
    renderCenter(category);
    expect(await screen.findByTestId(`kategorie-${category}`)).toBeInTheDocument();
    expect(screen.queryByTestId('lead-only-hint')).not.toBeInTheDocument();
  });
});

describe('R3-4 Verwaltung: nach dem Abschluss frisch aus der Cloud lesen', () => {
  it('@LZ-009 die Verwaltung gibt dem Dashboard ein Neuladen mit fresh: true (der Abschluss-Dialog nutzt es nach dem Abschluss)', async () => {
    role.current = 'co-admin';
    renderCenter('dashboard');
    expect(await screen.findByTestId('kategorie-dashboard')).toBeInTheDocument();
    void (dashboard.props as { onReload: () => unknown }).onReload();
    expect(reload).toHaveBeenCalledWith({ fresh: true });
  });
});
