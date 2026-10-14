/**
 * A-07d1 – @AN-024 „Auf allen anderen Geräten abmelden“.
 * Bestätigung zuerst; Erfolg und Fehler (mit Grund) als Toast.
 */
import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createInstance, type i18n as I18nInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import deAuth from '../../../../i18n/locales/de/auth.json';
import deCommon from '../../../../i18n/locales/de/common.json';
import { LogoutOthersSection } from '../LogoutOthersSection';

vi.unmock('i18next');
vi.unmock('react-i18next');

let i18n: I18nInstance;

beforeAll(async () => {
  i18n = createInstance();
  await i18n.use(initReactI18next).init({
    lng: 'de',
    fallbackLng: 'de',
    resources: { de: { auth: deAuth, common: deCommon } },
    ns: ['auth', 'common'],
    defaultNS: 'auth',
    interpolation: { escapeValue: false },
  });
});

function renderSection() {
  return render(
    <I18nextProvider i18n={i18n}>
      <LogoutOthersSection />
    </I18nextProvider>,
  );
}

const logout = vi.fn();
const showSuccess = vi.fn();
const showError = vi.fn();

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ logout }),
}));

vi.mock('../../../../components/ui/Toast', () => ({
  useToast: () => ({ showInfo: vi.fn(), showSuccess, showError }),
}));

beforeEach(() => {
  logout.mockReset();
  showSuccess.mockReset();
  showError.mockReset();
});

describe('LogoutOthersSection (A-07d1, @AN-024)', () => {
  it('Pflicht: Bestätigen ruft logout({ scope: others }) genau einmal und meldet Erfolg', async () => {
    logout.mockResolvedValue({ ok: true });
    renderSection();

    fireEvent.click(screen.getByTestId('logout-others'));
    expect(logout).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Andere Geräte abmelden' }));

    await waitFor(() => expect(showSuccess).toHaveBeenCalledWith('Alle anderen Geräte sind abgemeldet.'));
    expect(logout).toHaveBeenCalledTimes(1);
    expect(logout).toHaveBeenCalledWith({ scope: 'others' });
    expect(showError).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: ohne Bestätigung kein Aufruf, Abbrechen schließt den Dialog', () => {
    renderSection();

    fireEvent.click(screen.getByTestId('logout-others'));
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(logout).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Andere Geräte abmelden' })).toBeNull();
  });

  it('Gegenbeispiel: Server lehnt ab → Fehler-Toast mit Grund', async () => {
    logout.mockResolvedValue({ ok: false, reason: 'server' });
    renderSection();

    fireEvent.click(screen.getByTestId('logout-others'));
    fireEvent.click(screen.getByRole('button', { name: 'Andere Geräte abmelden' }));

    await waitFor(() =>
      expect(showError).toHaveBeenCalledWith(
        'Die anderen Geräte konnten nicht abgemeldet werden: Der Server hat die Abmeldung nicht angenommen. Bitte versuche es erneut.',
      ),
    );
    expect(showSuccess).not.toHaveBeenCalled();
  });
});
