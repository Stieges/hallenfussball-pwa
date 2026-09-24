/**
 * LoginScreen — "Passwort vergessen" mit OAuth-only-Konten (R6)
 *
 * Ghost-Password-Schutz: Ein OAuth-only-Konto (z.B. Google) darf beim Zurücksetzen des
 * Passworts NICHT versehentlich ein Passwort bekommen. LoginScreen.tsx#handleForgotPassword
 * fragt dafür checkOAuthOnlyUser() ab und sendet NUR dann resetPassword(), wenn das Konto kein
 * OAuth-only-Konto ist. Diese Logik selbst ändert sich durch R6 nicht (task-R6-brief.md) — nur
 * die interne Implementierung von checkOAuthOnlyUser (jetzt RPC statt Tabellen-SELECT). Dieser
 * Test belegt, dass der Flow von außen weiterhin exakt gleich funktioniert.
 *
 * @see ../LoginScreen.tsx (handleForgotPassword)
 * @see ../../utils/authHelpers.ts (checkOAuthOnlyUser)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { useAuthMock, checkOAuthOnlyUserMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  checkOAuthOnlyUserMock: vi.fn(),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'de' },
  }),
}));

vi.mock('../../../../hooks/useFocusTrap', () => ({
  useFocusTrap: () => ({ containerRef: { current: null } }),
}));

vi.mock('../../utils/authHelpers', async () => {
  const actual = await vi.importActual<typeof import('../../utils/authHelpers')>('../../utils/authHelpers');
  return {
    ...actual,
    checkOAuthOnlyUser: checkOAuthOnlyUserMock,
  };
});

import { LoginScreen } from '../LoginScreen';

function setupAuthMock(resetPassword = vi.fn().mockResolvedValue({ success: true })) {
  useAuthMock.mockReturnValue({
    login: vi.fn().mockResolvedValue({ success: true }),
    sendMagicLink: vi.fn(),
    loginWithGoogle: vi.fn(),
    continueAsGuest: vi.fn(),
    resetPassword,
    connectionState: 'connected',
    reconnect: vi.fn(),
  });
  return resetPassword;
}

describe('LoginScreen — Passwort vergessen (R6, OAuth-only-Ghost-Password-Schutz)', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    checkOAuthOnlyUserMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('zeigt den OAuth-Hinweis und sendet KEINEN Reset bei einem OAuth-only-Konto', async () => {
    const resetPassword = setupAuthMock();
    checkOAuthOnlyUserMock.mockResolvedValue({ isOAuthOnly: true, provider: 'google' });

    render(<LoginScreen />);
    fireEvent.change(screen.getByTestId('login-email-input'), { target: { value: 'oauth@example.com' } });
    fireEvent.click(screen.getByText('login.forgotPassword'));

    await waitFor(() => {
      expect(screen.getByTestId('login-error-message')).toHaveTextContent('Google-Anmeldung');
    });

    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('sendet den Reset für ein reguläres E-Mail/Passwort-Konto', async () => {
    const resetPassword = setupAuthMock();
    checkOAuthOnlyUserMock.mockResolvedValue({ isOAuthOnly: false, provider: 'email' });

    render(<LoginScreen />);
    fireEvent.change(screen.getByTestId('login-email-input'), { target: { value: 'normal@example.com' } });
    fireEvent.click(screen.getByText('login.forgotPassword'));

    await waitFor(() => {
      expect(resetPassword).toHaveBeenCalledWith('normal@example.com');
    });

    expect(screen.queryByTestId('login-error-message')).toBeNull();
  });

  it('sendet den Reset trotzdem, wenn die OAuth-Prüfung selbst fehlschlägt (bisheriges Verhalten)', async () => {
    const resetPassword = setupAuthMock();
    checkOAuthOnlyUserMock.mockResolvedValue({ isOAuthOnly: false, provider: 'unknown', error: 'Network error during check' });

    render(<LoginScreen />);
    fireEvent.change(screen.getByTestId('login-email-input'), { target: { value: 'unklar@example.com' } });
    fireEvent.click(screen.getByText('login.forgotPassword'));

    await waitFor(() => {
      expect(resetPassword).toHaveBeenCalledWith('unklar@example.com');
    });
  });
});
