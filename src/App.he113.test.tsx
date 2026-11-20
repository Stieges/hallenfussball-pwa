/**
 * @HE-113 (`2026-09-24_helfer-am-turniertag.md`): „Die Adresse zum Anlegen eines Turniers führt ihn auf die Startseite“ --
 * eine Gerätesitzung ohne Konto (anonym) landet von `/tournament/new` auf der Startseite und sieht den Assistenten nie.
 * Gegenbeispiel: der lokale Gast (nicht anonym) und ein Konto öffnen den Assistenten wie bisher (@W1-037).
 * Beide Bildschirme sind Attrappen mit Kennzeichen; geprüft wird, was die App zeigt.
 */
import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({ isAnonymous: false, isLoading: false }));

vi.mock('./lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: { rpc: vi.fn().mockResolvedValue({ data: null, error: null }), from: vi.fn() },
}));
vi.mock('./hooks/useTournaments', () => ({
  useTournaments: () => ({
    tournaments: [], loading: false, saveTournament: vi.fn(), deleteTournament: vi.fn(), softDeleteTournament: vi.fn(),
    restoreTournament: vi.fn(), permanentDeleteTournament: vi.fn(),
  }),
}));
vi.mock('./features/auth/hooks/useAuth', async (importOriginal) => {
  const original = await importOriginal<typeof import('./features/auth/hooks/useAuth')>();
  return { ...original, useAuth: () => ({ ...original.useAuth(), isAnonymous: session.isAnonymous, isLoading: session.isLoading }) };
});
vi.mock('./screens/TournamentCreationScreen', () => ({ TournamentCreationScreen: () => <div data-testid="wizard-attrappe" /> }));
vi.mock('./screens/DashboardScreen', () => ({ DashboardScreen: () => <div data-testid="startseite-attrappe" /> }));

import App from './App';

function Ort() { return <span data-testid="ort">{useLocation().pathname}</span>; }
function zeige() {
  render(<MemoryRouter initialEntries={['/tournament/new']}><App /><Ort /></MemoryRouter>);
}

beforeEach(() => { vi.clearAllMocks(); session.isAnonymous = false; session.isLoading = false; vi.mocked(localStorage.getItem).mockReturnValue(null); });

describe('@HE-113 Adresse zum Anlegen eines Turniers', () => {
  it('@HE-113 anonym: /tournament/new führt auf die Startseite, der Assistent erscheint nie', async () => {
    session.isAnonymous = true;
    zeige();
    expect(await screen.findByTestId('startseite-attrappe', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByTestId('ort')).toHaveTextContent(/^\/$/);
    expect(screen.queryByTestId('wizard-attrappe')).toBeNull();
  });

  it('@HE-113 Gegenbeispiel (lokaler Gast, @W1-037): der Assistent öffnet unter /tournament/new', async () => {
    session.isAnonymous = false;
    zeige();
    expect(await screen.findByTestId('wizard-attrappe', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByTestId('ort')).toHaveTextContent('/tournament/new');
  });

  it('@HE-113 Gegenbeispiel (Konto ruft /tournament/new auf): Assistent, keine Umleitung', async () => {
    session.isAnonymous = false;
    zeige();
    expect(await screen.findByTestId('wizard-attrappe', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByTestId('ort')).toHaveTextContent('/tournament/new');
    expect(screen.queryByTestId('startseite-attrappe')).toBeNull();
  });

  it('@HE-113 Anmeldung lädt noch: keine Umleitung (ein Konto wird nie fälschlich weggeschickt)', async () => {
    session.isAnonymous = false; session.isLoading = true;
    zeige();
    expect(await screen.findByTestId('wizard-attrappe', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByTestId('ort')).toHaveTextContent('/tournament/new');
  });
});
