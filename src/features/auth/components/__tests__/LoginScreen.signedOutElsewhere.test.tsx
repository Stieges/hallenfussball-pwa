/**
 * A-07d2 (@AN-024): Hinweis „Du wurdest von einem anderen Gerät aus abgemeldet“ auf der Anmeldeseite.
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

describe('LoginScreen – Hinweis bei Abmeldung durch ein anderes Gerät (A-07d2)', () => {
  beforeEach(() => {
    safeSessionStorage.removeItem('auth:signedOutElsewhere');
  });

  afterEach(() => {
    cleanup();
  });

  it('Pflicht: Merker gesetzt → Hinweis mit data-testid signed-out-elsewhere', () => {
    safeSessionStorage.setItem('auth:signedOutElsewhere', '1');

    render(<LoginScreen />);

    const hint = screen.getByTestId('signed-out-elsewhere');
    expect(hint.textContent).toBe('login.signedOutElsewhere');
    expect(hint.getAttribute('role')).toBe('status');
  });

  it('Gegenbeispiel: ohne Merker → kein Hinweis', () => {
    render(<LoginScreen />);

    expect(screen.queryByTestId('signed-out-elsewhere')).toBeNull();
  });
});
