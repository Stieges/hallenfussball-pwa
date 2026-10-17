/**
 * B-19a (@ME-003, @OB-028): Kiosk-Merkmal der Routen-Registry. Die Monitor-Route ist eine Kiosk-Route
 * (keine globalen Einblendungen); Verwaltung, Cockpit und Live-Seite bleiben unverändert.
 */
import { describe, expect, it } from 'vitest';
import { isKioskRoute, matchRoute } from '../routeRegistry';

describe('Kiosk-Routen (B-19a, @ME-003, @OB-028)', () => {
  it('@ME-003: die Monitor-Route ist eine Kiosk-Route', () => {
    expect(isKioskRoute('/display/tour-1/mon-1')).toBe(true);
  });

  it.each([
    ['/'],
    ['/archiv'],
    ['/tournament/abc-123'],
    ['/tournament/abc-123/admin'],
    ['/tournament/abc-123/edit'],
    ['/live/ABC123'],
    ['/public/tour-1'],
    ['/login'],
  ])('Gegenbeispiel: %s ist keine Kiosk-Route (Einblendungen bleiben)', (path) => {
    expect(isKioskRoute(path)).toBe(false);
  });

  it('unbekannte Adresse ist keine Kiosk-Route', () => {
    expect(isKioskRoute('/gibt-es-nicht')).toBe(false);
  });

  it('das Kiosk-Merkmal ändert den Routen-Match nicht', () => {
    expect(matchRoute('/display/tour-1/mon-1')).toEqual({
      name: 'monitorDisplay',
      params: { tournamentId: 'tour-1', monitorId: 'mon-1' },
    });
  });
});
