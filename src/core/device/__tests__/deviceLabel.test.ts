/**
 * Gerätebezeichnung (R-GA5-9, Review S3): „Feld 2: Tom (Handy)“ (@HE-049), „Tom (Helfer, Gerät Handy)“ (@HE-081).
 */
import { describe, expect, it } from 'vitest';
import { DEVICE_LABELS, deviceKind, deviceLabel } from '../deviceLabel';

const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  ipadAlt: 'Mozilla/5.0 (iPad; CPU OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  ipadOs: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  androidPhone: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36',
  androidTablet: 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
  firefoxTablet: 'Mozilla/5.0 (Android 14; Tablet; rv:131.0) Gecko/131.0 Firefox/131.0',
};

describe('deviceLabel – Geräteart für die Turnierleitung (@HE-049, @HE-081)', () => {
  it.each([
    ['iPhone', UA.iphone, 0, 'phone'],
    ['Android-Handy (Mobile)', UA.androidPhone, 5, 'phone'],
    ['iPad mit altem User-Agent', UA.ipadAlt, 5, 'tablet'],
    ['Android-Tablet ohne „Mobile“', UA.androidTablet, 5, 'tablet'],
    ['Firefox-Tablet', UA.firefoxTablet, 5, 'tablet'],
    ['Windows-Laptop', UA.windows, 0, 'computer'],
  ])('%s → %s', (_name, ua, touch, kind) => {
    expect(deviceKind(ua, touch)).toBe(kind);
  });

  it('iPadOS meldet sich als Mac: mit Touch-Punkten Tablet, ohne Touch Laptop (Gegenbeispiel)', () => {
    expect(deviceKind(UA.ipadOs, 5)).toBe('tablet');
    expect(deviceKind(UA.ipadOs, 0)).toBe('computer');
    expect(deviceKind(UA.ipadOs)).toBe('computer');
  });

  it('Bezeichnung wie im Mockup und höchstens 40 Zeichen (Server-Grenze)', () => {
    expect(deviceLabel(UA.iphone)).toBe('Handy');
    expect(deviceLabel(UA.androidTablet, 5)).toBe('Tablet');
    expect(deviceLabel(UA.windows)).toBe('Laptop');
    for (const label of Object.values(DEVICE_LABELS)) {
      expect(label.length).toBeGreaterThan(0);
      expect(label.length).toBeLessThanOrEqual(40);
    }
  });
});
