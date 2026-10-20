/**
 * Verbindungsanzeige im schmalen Kopf (Plan LT-2, @SL-140): am Handy bei Netz nur der Punkt (Name bleibt „Online“), ohne Netz immer mit Text.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { initRealDeI18n } from '../../../../test/realDeI18n';
import { ConnectionPill } from '../ConnectionPill';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

const zustand = vi.hoisted(() => ({ mobil: true, online: true }));
vi.mock('../../../../hooks/useBreakpoint', () => ({ useBreakpoint: () => ({ isMobile: zustand.mobil }) }));
vi.mock('../../../../hooks/useOnlineStatus', () => ({ useOnlineStatus: () => ({ isOnline: zustand.online }) }));

describe('ConnectionPill', () => {
  beforeEach(() => { zustand.mobil = true; zustand.online = true; });

  it('@SL-140 Handy mit Netz: nur der Punkt, zugänglicher Name „Online“', () => {
    render(<ConnectionPill />);
    const pille = screen.getByTestId('cockpit-verbindung');
    expect(pille.textContent).toBe('');
    expect(pille).toHaveAccessibleName('Online');
  });

  it('@SL-140 Gegenbeispiel Handy ohne Netz: Text „Offline“ sichtbar', () => {
    zustand.online = false;
    render(<ConnectionPill />);
    expect(screen.getByTestId('cockpit-verbindung').textContent).toBe('Offline');
  });

  it('@SL-140 Gegenbeispiel Tablet/Laptop mit Netz: Text „Online“ sichtbar', () => {
    zustand.mobil = false;
    render(<ConnectionPill />);
    expect(screen.getByTestId('cockpit-verbindung').textContent).toBe('Online');
  });
});
