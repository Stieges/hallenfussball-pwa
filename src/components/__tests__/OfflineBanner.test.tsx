/**
 * A-06h (Brief A9): Der Verbinden-Knopf im OfflineBanner stoesst zusaetzlich zur
 * Neuverbindung die Uebertragung an (resyncNow) — @FU-013/@FU-015.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { OfflineBanner } from '../OfflineBanner';
import { cssVars } from '../../design-tokens';
import { ResyncNowContext } from '../../features/match-engine/resyncNowContext';

const reconnect = vi.fn();
const resyncNow = vi.fn((): Promise<void> => Promise.resolve());

vi.mock('../../hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => ({ isOnline: false, wasOffline: false }),
}));

vi.mock('../../features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ reconnect }),
}));

function renderWithResync(ui: ReactElement) {
  return render(<ResyncNowContext.Provider value={resyncNow}>{ui}</ResyncNowContext.Provider>);
}

describe('OfflineBanner — Verbinden-Knopf (A-06h)', () => {
  beforeEach(() => {
    reconnect.mockClear();
    resyncNow.mockClear();
  });

  it('Klick ruft reconnect UND resyncNow je 1x', () => {
    renderWithResync(<OfflineBanner />);

    fireEvent.click(screen.getByTestId('offline-banner-connect'));

    expect(reconnect).toHaveBeenCalledTimes(1);
    expect(resyncNow).toHaveBeenCalledTimes(1);
  });

  it('Gegenbeispiel: ohne Klick wird nichts angestossen', () => {
    renderWithResync(<OfflineBanner />);

    expect(reconnect).not.toHaveBeenCalled();
    expect(resyncNow).not.toHaveBeenCalled();
  });

  it('Knopf hat ein Touch-Ziel von mindestens 44px aus den Tokens', () => {
    renderWithResync(<OfflineBanner />);

    expect(screen.getByTestId('offline-banner-connect')).toHaveStyle({
      minHeight: cssVars.touchTargets.minimum,
    });
  });
});
