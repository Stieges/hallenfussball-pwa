/**
 * B-41 Fixrunde 1 (Controller-Ruling): Zuschauer-Seite und Monitor zeigen Deutsch, auch bei
 * englischer Browsersprache. Die globale Sprache bleibt unberührt (kein changeLanguage).
 *
 * Gemockt nur die Datenquellen (wie LiveViewScreen.scenarios.test.tsx). i18n ist das echte
 * App-i18n aus src/i18n (Browsersprache en-US in jsdom).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { buildLiveViewTournament, SHARE_CODE } from '../../screens/__tests__/liveViewFixture';

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

vi.unmock('i18next');
vi.unmock('react-i18next');

import i18n from '../index';
import { anzeigeT, anzeigeI18n, ANZEIGE_SPRACHE } from '../anzeigeSprache';
import { LiveViewScreen } from '../../screens/LiveViewScreen';
import { MonitorDisplayPage } from '../../features/monitor-display/MonitorDisplayPage';
import { applyFetchError, initialDisplayState } from '../../features/monitor-display/monitorDisplayState';
import { RepositoryProvider } from '../../core/contexts/RepositoryContext';

describe('Feste Anzeigesprache (B-41 Fixrunde 1)', () => {
  beforeEach(() => {
    supabaseGet.mockReset();
    localGet.mockReset();
  });

  it('Vorbedingung: Browsersprache ist Englisch, die globale Sprache steht auf en', () => {
    expect(i18n.language).toBe('en');
    expect(ANZEIGE_SPRACHE).toBe('de');
  });

  it('Gegenbeispiel: globale Sprache bleibt en, ein Admin-Text bleibt englisch', () => {
    expect(anzeigeI18n().language).toBe('de');
    expect(i18n.language).toBe('en');
    expect(i18n.t('admin:visibility.printQr')).toBe('Print QR code');
  });

  it('Nicht-React: anzeigeT liefert Deutsch, applyFetchError meldet den deutschen Standardtext', () => {
    expect(anzeigeT('monitor:error.connection')).toMatch(/^Turnier konnte nicht geladen werden/);
    const next = applyFetchError(initialDisplayState, 'kein Fehlerobjekt');
    expect(next.error).toBe('Fehler beim Laden');
  });

  it('Zuschauer-Seite: Nicht-gefunden-Ansicht zeigt „Zur Startseite“ (nicht englisch)', async () => {
    supabaseGet.mockResolvedValue(null);
    localGet.mockResolvedValue(null);
    render(
      <RepositoryProvider user={null}>
        <MemoryRouter initialEntries={[`/live/${SHARE_CODE}`]}>
          <LiveViewScreen shareCode={SHARE_CODE} />
        </MemoryRouter>
      </RepositoryProvider>
    );
    expect(await screen.findByRole('button', { name: 'Zur Startseite' })).toBeInTheDocument();
    expect(screen.queryByText('Go to start page')).toBeNull();
    expect(i18n.language).toBe('en');
  });

  it('Zuschauer-Seite: Tabellen-/Spielplan-Ansicht zeigt „Mein Team:“ und den geteilten Baustein „Ende“', async () => {
    const tournament = buildLiveViewTournament({ hideRankingsForPublic: true });
    supabaseGet.mockResolvedValue(tournament);
    localGet.mockResolvedValue(null);
    render(
      <RepositoryProvider user={null}>
        <MemoryRouter initialEntries={[`/live/${SHARE_CODE}`]}>
          <LiveViewScreen shareCode={SHARE_CODE} />
        </MemoryRouter>
      </RepositoryProvider>
    );
    await screen.findAllByRole('heading', { level: 1, name: tournament.title });
    expect(screen.getByText('Mein Team:')).toBeInTheDocument();
    expect(screen.getAllByText('Ende').length).toBeGreaterThan(0);
    expect(screen.queryByText('Schedule')).toBeNull();
  });

  it('Monitor: Ladeansicht zeigt „Lade Display...“ (nicht englisch)', () => {
    render(
      <RepositoryProvider user={null}>
        <MonitorDisplayPage tournamentId="t-1" monitorId="m-1" />
      </RepositoryProvider>
    );
    expect(screen.getByText('Lade Display...')).toBeInTheDocument();
    expect(screen.queryByText('Loading display...')).toBeNull();
    expect(i18n.language).toBe('en');
  });
});
