/**
 * @AN-059: Nach dem Anmelden bleibt man, wohin man getippt hat. Der Zeitgeber der Weiterleitung nach der Erfolgsmeldung
 * wird beim Verlassen der Anmeldeseite gelöscht; wer stehen bleibt, kommt nach der Erfolgsmeldung zur Startseite.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';

const useAuthMock = vi.fn();
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => useAuthMock() }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'de' } }),
}));
vi.mock('../../../../hooks/useFocusTrap', () => ({
  useFocusTrap: () => ({ containerRef: { current: null } }),
}));

import { LoginScreen } from '../LoginScreen';

function setupAuth(migratedCount?: number): void {
  useAuthMock.mockReturnValue({
    login: vi.fn().mockResolvedValue({ success: true, ...(migratedCount ? { migratedCount } : {}) }),
    sendMagicLink: vi.fn(),
    loginWithGoogle: vi.fn(),
    continueAsGuest: vi.fn(),
    resetPassword: vi.fn(),
    connectionState: 'connected',
    reconnect: vi.fn(),
  });
}

async function anmelden(onSuccess: () => void) {
  const view = render(<LoginScreen onSuccess={onSuccess} />);
  fireEvent.change(screen.getByTestId('login-email-input'), { target: { value: 'olli@example.org' } });
  fireEvent.change(screen.getByTestId('login-password-input'), { target: { value: 'Passwort-123' } });
  await act(async () => { fireEvent.click(screen.getByTestId('login-submit-button')); });
  return view;
}

describe('@AN-059 LoginScreen: Weiterleitung nach dem Anmelden', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useAuthMock.mockReset();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('Nach dem Anmelden bleibt man, wohin man getippt hat: Seite vor Ablauf verlassen → onSuccess nie gerufen', async () => {
    setupAuth();
    const onSuccess = vi.fn();
    const view = await anmelden(onSuccess);
    act(() => { vi.advanceTimersByTime(500); });
    view.unmount();
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('auch beim längeren Zeitgeber (übernommene Turniere, 2,5 s) wird nach dem Verlassen nichts gerufen', async () => {
    setupAuth(3);
    const onSuccess = vi.fn();
    const view = await anmelden(onSuccess);
    act(() => { vi.advanceTimersByTime(2000); });
    view.unmount();
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: Wer stehen bleibt, kommt nach der Erfolgsmeldung zur Startseite (onSuccess nach Ablauf)', async () => {
    setupAuth();
    const onSuccess = vi.fn();
    await anmelden(onSuccess);
    act(() => { vi.advanceTimersByTime(1400); });
    expect(onSuccess).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(200); });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('Erfolgsmeldung geschlossen: onSuccess genau einmal, auch nach Ablauf von 1,5 s und 2,5 s (kein zweiter Sprung auf die Startseite)', async () => {
    setupAuth();
    const onSuccess = vi.fn();
    await anmelden(onSuccess);
    act(() => { vi.advanceTimersByTime(300); });
    fireEvent.click(screen.getByText('loginDialogs.success.continue'));
    expect(onSuccess).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(1500); });
    act(() => { vi.advanceTimersByTime(1000); });
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('Erfolgsmeldung geschlossen bei übernommenen Turnieren (2,5 s): onSuccess genau einmal', async () => {
    setupAuth(3);
    const onSuccess = vi.fn();
    await anmelden(onSuccess);
    fireEvent.click(screen.getByText('loginDialogs.success.continue'));
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});
