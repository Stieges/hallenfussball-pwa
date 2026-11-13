/**
 * H4-9 @HT-026: Ein zweiter Rechner öffnet die feste Adresse des Unterpunkts „Hallenton“ und ist noch nicht angemeldet → „Anmelden“ merkt die
 * Adresse und öffnet die Anmeldung (danach landet er im selben Unterpunkt, `loginRueckkehr.test.ts`). Gegenbeispiele: wer angemeldet ist, aber
 * kein Recht hat (Helfer), sieht weiter „Ändern nur durch die Turnierleitung“; wer das Recht hat, sieht den Inhalt.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthContext } from '../../auth/context/authContextInstance';
import type { AuthContextValue } from '../../auth/context/authContextValue';
import { RUECKKEHR_SCHLUESSEL } from '../../auth/utils/loginRueckkehr';

vi.unmock('i18next');
vi.unmock('react-i18next');

const recht = vi.hoisted(() => ({ erlaubt: false, laedt: false }));
vi.mock('../../auth/hooks/useCan', () => ({
  useCan: () => recht.erlaubt,
  useCanState: () => ({ allowed: recht.erlaubt, isLoading: recht.laedt }),
}));
vi.mock('../../../hooks/useTournamentClosed', () => ({ useTournamentClosed: () => false }));

import i18n from 'i18next';
import hallentonDe from '../../../i18n/locales/de/hallenton.json';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { CategoryRightGate } from '../components/CategoryRightGate';

await initRealDeI18n();
i18n.addResourceBundle('de', 'hallenton', hallentonDe, true, true); // der gemeinsame Helfer kennt den Namensraum noch nicht

const ADRESSE = '/tournament/hallencup-nord/admin/hallenton';
const auth = (user: unknown, isLoading = false): AuthContextValue => ({ user, isLoading, isGuest: false } as unknown as AuthContextValue);

function Ort() {
  return <span data-testid="ort">{useLocation().pathname}</span>;
}

function zeige(wert: AuthContextValue | undefined) {
  render(
    <AuthContext.Provider value={wert}>
      <MemoryRouter initialEntries={[ADRESSE]}>
        <Routes>
          <Route path="*" element={<><Ort /><CategoryRightGate category="hallenton" tournamentId="hallencup-nord"><div data-testid="inhalt" /></CategoryRightGate></>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

beforeEach(() => { recht.erlaubt = false; recht.laedt = false; window.sessionStorage.clear(); });

describe('@HT-026 zweiter Rechner, noch nicht angemeldet', () => {
  it('Hinweis „Bitte melde dich an“ statt „Ändern nur durch die Turnierleitung“; „Anmelden“ merkt die Adresse und öffnet die Anmeldung', () => {
    zeige(auth(null));
    expect(screen.getByTestId('hallenton-anmelden-hinweis')).toHaveTextContent('Bitte melde dich an');
    expect(screen.queryByTestId('lead-only-hint')).toBeNull();
    fireEvent.click(screen.getByTestId('hallenton-anmelden'));
    expect(window.sessionStorage.getItem(RUECKKEHR_SCHLUESSEL)).toBe(ADRESSE);
    expect(screen.getByTestId('ort')).toHaveTextContent('/login');
  });
  it('Gegenbeispiel: angemeldet ohne Recht (Helfer) → weiter „Ändern nur durch die Turnierleitung“, keine Anmelde-Taste', () => {
    zeige(auth({ id: 'tom' }));
    expect(screen.getByTestId('lead-only-hint')).toBeInTheDocument();
    expect(screen.queryByTestId('hallenton-anmelden-hinweis')).toBeNull();
  });
  it('Gegenbeispiel: angemeldet mit Recht → der Inhalt; ohne Anmeldeumgebung (Tests, Prüfstände) kein Anmelde-Hinweis', () => {
    recht.erlaubt = true;
    zeige(auth({ id: 'olli' }));
    expect(screen.getByTestId('inhalt')).toBeInTheDocument();
  });
  it('Gegenbeispiel: die Anmeldung lädt noch → kein Anmelde-Hinweis', () => {
    zeige(auth(null, true));
    expect(screen.queryByTestId('hallenton-anmelden-hinweis')).toBeNull();
  });
});
