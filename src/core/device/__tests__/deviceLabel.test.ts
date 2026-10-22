/**
 * Gerätebezeichnung (R-GA5-9, Review S3, Review #331 M-3): an den Server geht der sprachneutrale Schlüssel, die Anzeige
 * übersetzt – „Feld 2: Tom (Handy)“ (@HE-049), „Tom (Helfer, Gerät Handy)“ (@HE-081).
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.unmock('i18next');

const { default: i18next } = await import('i18next');
const deCommon = (await import('../../../i18n/locales/de/common.json')).default;
const enCommon = (await import('../../../i18n/locales/en/common.json')).default;
const { DEVICE_KINDS, describeDeviceLabel, deviceKind, deviceLabel, deviceLabelText } = await import('../deviceLabel');

beforeAll(async () => {
  await i18next.init({ lng: 'de', fallbackLng: 'de', defaultNS: 'common', resources: { de: { common: deCommon }, en: { common: enCommon } } });
});

const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  ipadAlt: 'Mozilla/5.0 (iPad; CPU OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  ipadOs: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  androidPhone: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36',
  androidTablet: 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
  firefoxTablet: 'Mozilla/5.0 (Android 14; Tablet; rv:131.0) Gecko/131.0 Firefox/131.0',
};

describe('deviceKind – Geräteart (@HE-049, @HE-081)', () => {
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

  it('iPadOS meldet sich als Mac: mit Touch-Punkten Tablet, ohne Touch Computer (Gegenbeispiel)', () => {
    expect(deviceKind(UA.ipadOs, 5)).toBe('tablet');
    expect(deviceKind(UA.ipadOs, 0)).toBe('computer');
    expect(deviceKind(UA.ipadOs)).toBe('computer');
  });
});

describe('deviceLabel – Wert für den Server ist sprachneutral (Review #331 M-3)', () => {
  it('sendet den Schlüssel, nie ein deutsches Anzeigewort', () => {
    expect(deviceLabel(UA.iphone)).toBe('phone');
    expect(deviceLabel(UA.androidTablet, 5)).toBe('tablet');
    expect(deviceLabel(UA.windows)).toBe('computer');
    for (const kind of DEVICE_KINDS) {
      expect(kind).toMatch(/^[a-z]{1,40}$/);
    }
  });
});

describe('deviceLabelText – Anzeige DE/EN (@HE-049 „Feld 2: Tom (Handy)“)', () => {
  it('übersetzt die Schlüssel in der Sprache der Anzeige', () => {
    expect(deviceLabelText('phone', 'de')).toBe('Handy');
    expect(deviceLabelText('tablet', 'de')).toBe('Tablet');
    expect(deviceLabelText('computer', 'de')).toBe('Laptop');
    expect(deviceLabelText('phone', 'en')).toBe('Phone');
    expect(deviceLabelText('computer', 'en')).toBe('Computer');
    expect(deviceLabelText('phone')).toBe('Handy');
  });

  it('zeigt fremde oder alte Werte so, wie sie gespeichert sind; nichts gespeichert → null', () => {
    expect(deviceLabelText('Toms Tablet')).toBe('Toms Tablet');
    expect(describeDeviceLabel(' Handy ')).toEqual({ text: 'Handy' });
    expect(deviceLabelText(null)).toBeNull();
    expect(deviceLabelText('   ')).toBeNull();
    expect(describeDeviceLabel(undefined)).toBeNull();
  });

  it('DE und EN haben für jede Geräteart einen Text', () => {
    for (const kind of DEVICE_KINDS) {
      expect(deCommon.deviceKind[kind].length).toBeGreaterThan(0);
      expect(enCommon.deviceKind[kind].length).toBeGreaterThan(0);
    }
  });
});
