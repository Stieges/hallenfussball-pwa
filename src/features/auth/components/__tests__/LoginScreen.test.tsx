/**
 * LoginScreen tests — connection-state UX (HP-5 hotfix)
 *
 * Verifies the three connection-state surfaces:
 *  1. Browser is offline → loud OfflineBanner
 *  2. Browser online, auth handshake stalled → subtle stalled-pill
 *  3. Browser online, auth handshake slow (>3s) → subtle connecting-pill
 *  4. Browser online, handshake fine → no banner / no pill
 *  5. Form submission stays available across every state.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';

const useAuthMock = vi.fn();

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'de' },
  }),
}));

// Focus trap is a noop in tests
vi.mock('../../../../hooks/useFocusTrap', () => ({
  useFocusTrap: () => ({ containerRef: { current: null } }),
}));

import { LoginScreen } from '../LoginScreen';

interface AuthMockOverrides {
  connectionState?: 'connecting' | 'connected' | 'offline';
}

function setupAuthMock(overrides: AuthMockOverrides = {}): void {
  useAuthMock.mockReturnValue({
    login: vi.fn().mockResolvedValue({ success: true }),
    sendMagicLink: vi.fn(),
    loginWithGoogle: vi.fn(),
    continueAsGuest: vi.fn(),
    resetPassword: vi.fn(),
    connectionState: overrides.connectionState ?? 'connected',
    reconnect: vi.fn(),
  });
}

function setBrowserOnline(value: boolean): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value);
}

describe('LoginScreen — connection-state UX', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('renders no offline banner and no pill when browser is online and auth is connected', () => {
    const browserOnlineSpy = setBrowserOnline(true);
    setupAuthMock({ connectionState: 'connected' });

    render(<LoginScreen />);

    expect(screen.queryByTestId('offline-banner')).toBeNull();
    expect(screen.queryByTestId('connecting-indicator')).toBeNull();
    expect(screen.getByTestId('login-email-input')).toBeEnabled();

    browserOnlineSpy.mockRestore();
  });

  it('renders the loud OfflineBanner only when the browser reports offline', () => {
    const browserOnlineSpy = setBrowserOnline(false);
    setupAuthMock({ connectionState: 'offline' });

    render(<LoginScreen />);

    expect(screen.getByTestId('offline-banner')).toBeInTheDocument();
    expect(screen.queryByTestId('connecting-indicator')).toBeNull();
    expect(screen.getByTestId('login-email-input')).toBeEnabled();

    browserOnlineSpy.mockRestore();
  });

  it('renders the subtle stalled-pill when handshake timed out but browser is online', () => {
    const browserOnlineSpy = setBrowserOnline(true);
    setupAuthMock({ connectionState: 'offline' });

    render(<LoginScreen />);

    expect(screen.queryByTestId('offline-banner')).toBeNull();
    const pill = screen.getByTestId('connecting-indicator');
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveAttribute('data-variant', 'stalled');
    expect(screen.getByTestId('login-email-input')).toBeEnabled();

    browserOnlineSpy.mockRestore();
  });

  it('renders the connecting-pill only after the soft 3s threshold has passed', () => {
    vi.useFakeTimers();
    const browserOnlineSpy = setBrowserOnline(true);
    setupAuthMock({ connectionState: 'connecting' });

    render(<LoginScreen />);

    expect(screen.queryByTestId('connecting-indicator')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    const pill = screen.getByTestId('connecting-indicator');
    expect(pill).toHaveAttribute('data-variant', 'connecting');

    browserOnlineSpy.mockRestore();
  });

  it('reacts to window online/offline events for the browser-online state', () => {
    const browserOnlineSpy = setBrowserOnline(true);
    setupAuthMock({ connectionState: 'offline' });

    render(<LoginScreen />);

    // Initially online + offline auth → subtle pill, no banner
    expect(screen.queryByTestId('offline-banner')).toBeNull();
    expect(screen.getByTestId('connecting-indicator')).toBeInTheDocument();

    // Browser flips offline → banner replaces pill
    browserOnlineSpy.mockReturnValue(false);
    act(() => {
      fireEvent(window, new Event('offline'));
    });
    expect(screen.getByTestId('offline-banner')).toBeInTheDocument();
    expect(screen.queryByTestId('connecting-indicator')).toBeNull();

    // Browser comes back online → pill returns, banner gone
    browserOnlineSpy.mockReturnValue(true);
    act(() => {
      fireEvent(window, new Event('online'));
    });
    expect(screen.queryByTestId('offline-banner')).toBeNull();
    expect(screen.getByTestId('connecting-indicator')).toBeInTheDocument();

    browserOnlineSpy.mockRestore();
  });
});
