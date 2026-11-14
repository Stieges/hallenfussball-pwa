/**
 * H4-9 @HT-026 (Fixrunde 1, B2/B3): der Rücksprung nach der Anmeldung als Ablauf gerendert, je Anmeldeart –
 * Passwort (`LoginRoute`), Google im selben Tab und Magic-Link in einem neuen Tab (beide `AuthCallback`). Erwartung aus dem Gherkin:
 * „danach öffnet sich derselbe Unterpunkt ‚Hallenton‘“. Gegenbeispiele: ohne Merker die Startseite, Passwort-setzen bleibt Passwort-setzen.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { merkeRueckkehr } from '../../utils/loginRueckkehr';

const ADRESSE = '/tournament/hallencup-nord/admin/hallenton';
const supa = vi.hoisted((): { session: unknown; code: string | null; ergebnis: string } => ({ session: null, code: null, ergebnis: '/' }));

vi.mock('../../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { auth: { getSession: () => Promise.resolve({ data: { session: supa.session } }) } },
}));
vi.mock('../../utils/authCallbackHelpers', () => ({
  parseAllAuthParams: () => ({ accessToken: null, refreshToken: null, code: supa.code, type: null, errorDescription: null }),
  handleExistingSession: () => ({ handled: true, redirectTo: supa.ergebnis }),
  handleCodeExchange: () => Promise.resolve({ handled: true, redirectTo: supa.ergebnis }),
  handleImplicitFlow: () => Promise.resolve({ handled: true, redirectTo: supa.ergebnis }),
}));
vi.mock('../LoginScreen', () => ({
  LoginScreen: ({ onSuccess }: { onSuccess: () => void }) => <button type="button" data-testid="login-erfolg" onClick={onSuccess}>Anmelden (Doppel)</button>,
}));

import { AuthCallback } from '../AuthCallback';
import { LoginRoute } from '../LoginRoute';
import { FalscherSpeicher } from '../../../../test/hallenton/falschesGeraet';

function Ort() {
  return <span data-testid="ort">{useLocation().pathname}</span>;
}
function zeige(start: string) {
  render(
    <MemoryRouter initialEntries={[start]}>
      <Ort />
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );
}

const speicherBinden = (): void => {
  const speicher = new FalscherSpeicher();
  vi.mocked(localStorage.getItem).mockImplementation((k: string) => speicher.getItem(k));
  vi.mocked(localStorage.setItem).mockImplementation((k: string, w: string) => speicher.setItem(k, w));
  vi.mocked(localStorage.removeItem).mockImplementation((k: string) => speicher.removeItem(k));
};

beforeEach(() => { speicherBinden(); supa.session = null; supa.code = null; supa.ergebnis = '/'; });

describe('@HT-026 Rücksprung je Anmeldeart', () => {
  it('Passwort: „Anmelden“ im Unterpunkt merkt die Adresse, nach der Anmeldung öffnet sich derselbe Unterpunkt', () => {
    merkeRueckkehr(ADRESSE);
    zeige('/login');
    fireEvent.click(screen.getByTestId('login-erfolg'));
    expect(screen.getByTestId('ort')).toHaveTextContent(ADRESSE);
  });
  it('Gegenbeispiel Passwort: ohne Merker die Startseite', () => {
    zeige('/login');
    fireEvent.click(screen.getByTestId('login-erfolg'));
    expect(screen.getByTestId('ort')).toHaveTextContent(/^\/$/);
  });
  it('Google im selben Tab (Sitzung steht schon) → derselbe Unterpunkt', async () => {
    supa.session = { user: { id: 'olli' } };
    merkeRueckkehr(ADRESSE);
    zeige('/auth/callback');
    await waitFor(() => expect(screen.getByTestId('ort')).toHaveTextContent(ADRESSE));
  });
  it('Magic-Link in einem neuen Tab (Code im Link, Merker im gemeinsamen Speicher) → derselbe Unterpunkt', async () => {
    supa.code = 'abc';
    merkeRueckkehr(ADRESSE);
    zeige('/auth/callback');
    await waitFor(() => expect(screen.getByTestId('ort')).toHaveTextContent(ADRESSE));
    expect(window.localStorage.getItem('loginRueckkehr')).toBeNull(); // nach dem Lesen gelöscht
  });
  it('Gegenbeispiel Magic-Link ohne Merker: Startseite', async () => {
    supa.code = 'abc';
    zeige('/auth/callback');
    await waitFor(() => expect(screen.getByTestId('ort')).toHaveTextContent(/^\/$/));
  });
  it('Gegenbeispiel: Passwort zurücksetzen bleibt „Passwort setzen“ und verbraucht den Merker nicht', async () => {
    supa.session = { user: { id: 'olli' } };
    supa.ergebnis = '/set-password';
    merkeRueckkehr(ADRESSE);
    zeige('/auth/callback');
    await waitFor(() => expect(screen.getByTestId('ort')).toHaveTextContent('/set-password'));
    expect(window.localStorage.getItem('loginRueckkehr')).not.toBeNull();
  });
});
