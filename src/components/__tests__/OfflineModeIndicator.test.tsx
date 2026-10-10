/**
 * A-06h (Brief A9): Der Verbinden-Knopf im OfflineModeIndicator (Dashboard) stoesst
 * zusaetzlich zur Neuverbindung die Uebertragung an (resyncNow) — dritter Knopf.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { OfflineModeIndicator } from '../OfflineModeIndicator';
import { ResyncNowContext } from '../../features/match-engine/resyncNowContext';

const reconnect = vi.fn();
const resyncNow = vi.fn((): Promise<void> => Promise.resolve());

vi.mock('../../features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ connectionState: 'offline', reconnect }),
}));

function renderWithResync(ui: ReactElement) {
  return render(<ResyncNowContext.Provider value={resyncNow}>{ui}</ResyncNowContext.Provider>);
}

describe('OfflineModeIndicator — Verbinden-Knopf (A-06h)', () => {
  beforeEach(() => {
    reconnect.mockClear();
    resyncNow.mockClear();
  });

  it('Klick ruft reconnect UND resyncNow je 1x', () => {
    renderWithResync(<OfflineModeIndicator />);

    fireEvent.click(screen.getByTestId('offline-banner-connect'));

    expect(reconnect).toHaveBeenCalledTimes(1);
    expect(resyncNow).toHaveBeenCalledTimes(1);
  });

  it('Gegenbeispiel: ohne Klick wird nichts angestossen', () => {
    renderWithResync(<OfflineModeIndicator />);

    expect(reconnect).not.toHaveBeenCalled();
    expect(resyncNow).not.toHaveBeenCalled();
  });
});
