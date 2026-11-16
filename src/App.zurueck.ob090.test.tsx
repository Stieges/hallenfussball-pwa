/**
 * @OB-090 „Zurück“ führt nie aus der App heraus – Anmeldung, Registrieren, Profil, Einstellungen.
 * Gherkin (docs/anforderungen/2026-10-02_oberflaeche.md): Seite direkt über einen Link geöffnet (kein Schritt davor in der Sitzung) →
 * „Zurück“ landet auf der Startseite; kam man aus der App, führt „Zurück“ wie bisher auf die vorige Seite der App.
 * Die vier Bildschirme sind Attrappen mit einer Taste, die die Eigenschaft `onBack` der App auslöst; geprüft wird die Adresse danach.
 */
import 'fake-indexeddb/auto';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: { rpc: vi.fn().mockResolvedValue({ data: null, error: null }), from: vi.fn() },
}));
vi.mock('./hooks/useTournaments', () => ({
  useTournaments: () => ({
    tournaments: [],
    loading: false,
    saveTournament: vi.fn(),
    deleteTournament: vi.fn(),
    softDeleteTournament: vi.fn(),
    restoreTournament: vi.fn(),
    permanentDeleteTournament: vi.fn(),
  }),
}));

vi.mock('./features/auth/components/LoginScreen', () => ({ LoginScreen: zurueckTasteLogin }));
vi.mock('./features/auth/components/RegisterScreen', () => ({ RegisterScreen: zurueckTasteLogin }));
vi.mock('./features/auth/components/UserProfileScreen', () => ({ UserProfileScreen: zurueckTasteLogin }));
vi.mock('./features/auth/components/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('./screens/SettingsScreen', () => ({ SettingsScreen: zurueckTasteLogin }));

import App from './App';

/** Attrappe aller vier Bildschirme: eine Taste, die `onBack` der App auslöst (Funktionsdeklaration, damit sie in den `vi.mock`-Fabriken schon steht). */
function zurueckTasteLogin(props: { onBack?: () => void }) {
  return <button type="button" data-testid="seite-zurueck" onClick={props.onBack}>zurueck</button>;
}

function Ort() {
  const ort = useLocation();
  return <span data-testid="ort">{`${ort.pathname}${ort.search}`}</span>;
}

async function oeffne(eintraege: string[], index: number): Promise<void> {
  render(<MemoryRouter initialEntries={eintraege} initialIndex={index}><Ort /><App /></MemoryRouter>);
  fireEvent.click(await screen.findByTestId('seite-zurueck', {}, { timeout: 5000 }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(localStorage.getItem).mockReturnValue(null);
});

describe.each([
  ['die Anmeldung', '/login'],
  ['das Registrieren', '/register'],
  ['das Profil', '/profile'],
  ['die Einstellungen', '/settings'],
])('@OB-090 %s (%s)', { timeout: 20_000 }, (_name, pfad) => {
  it('direkt über einen Link geöffnet (kein Schritt davor): „Zurück“ steht auf der Startseite der App', async () => {
    await oeffne([pfad], 0);
    await waitFor(() => expect(screen.getByTestId('ort')).toHaveTextContent(/^\/$/), { timeout: 5000 });
  });

  it('Gegenbeispiel: aus der App gekommen (Schritt davor): „Zurück“ führt wie bisher auf die vorige Seite', async () => {
    await oeffne(['/datenschutz', pfad], 1);
    await waitFor(() => expect(screen.getByTestId('ort')).toHaveTextContent('/datenschutz'), { timeout: 5000 });
  });
});
