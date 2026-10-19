/**
 * C-SITZUNG-STILL (@AN-021, Ü1.2): Hinweis „Anmeldung abgelaufen“ auf der Anmeldeseite und im App-Baum.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { safeSessionStorage } from '../../../../core/utils/safeStorage';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    login: vi.fn(),
    sendMagicLink: vi.fn(),
    loginWithGoogle: vi.fn(),
    continueAsGuest: vi.fn(),
    resetPassword: vi.fn(),
    connectionState: 'connected',
    reconnect: vi.fn(),
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'de' } }),
}));

vi.mock('../../../../hooks/useFocusTrap', () => ({
  useFocusTrap: () => ({ containerRef: { current: null } }),
}));

import { LoginScreen } from '../LoginScreen';

describe('LoginScreen – Hinweis bei abgelaufener Anmeldung (@AN-021)', () => {
  beforeEach(() => {
    safeSessionStorage.removeItem('auth:sessionExpired');
  });

  afterEach(() => {
    cleanup();
  });

  it('@AN-021 Pflicht: Merker gesetzt → Hinweis mit data-testid session-expired', () => {
    safeSessionStorage.setItem('auth:sessionExpired', '1');

    render(<LoginScreen />);

    const hint = screen.getByTestId('session-expired');
    expect(hint.textContent).toBe('auth:errors.sessionExpired');
    expect(hint.getAttribute('role')).toBe('status');
  });

  it('Gegenbeispiel: ohne Merker → kein Hinweis', () => {
    render(<LoginScreen />);

    expect(screen.queryByTestId('session-expired')).toBeNull();
  });
});
