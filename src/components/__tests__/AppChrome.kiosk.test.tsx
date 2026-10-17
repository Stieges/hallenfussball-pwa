/**
 * B-19a (@ME-003, Review W1): Der Update-Hinweis erscheint auf Kiosk-Routen nie – auch im Fenster vor dem
 * Neulade-Tor, also bevor die Monitor-Seite es setzt. Die Prüfung sitzt im Slot selbst, nicht im Tor.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SwUpdateNoticeSlot } from '../AppChrome';

vi.mock('../../lib/supabase', () => ({ isSupabaseConfigured: false, supabase: {} }));

function slotAuf(adresse: string) {
  return render(
    <MemoryRouter initialEntries={[adresse]}>
      <SwUpdateNoticeSlot updateNow={() => undefined} />
    </MemoryRouter>,
  );
}

describe('Update-Hinweis auf Kiosk-Routen (B-19a, @ME-003)', () => {
  it('@ME-003 Kiosk-Route: der Update-Hinweis (role="status") erscheint nicht – auch ohne Tor', () => {
    slotAuf('/display/tour-1/mon-1');
    expect(screen.queryByTestId('sw-update-notice')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('Gegenbeispiel „/“ (Verwaltung): derselbe Hinweis erscheint', () => {
    slotAuf('/');
    expect(screen.getByTestId('sw-update-notice')).toBeInTheDocument();
  });
});
