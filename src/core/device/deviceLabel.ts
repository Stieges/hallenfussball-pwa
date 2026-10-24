/**
 * Gerätebezeichnung für Helfer-Anfragen und Steuer-Anzeige (Plan GA5 v2.1 R-GA5-9, Review S3; @HE-049 „Feld 2: Tom (Handy)“,
 * @HE-081 „Tom (Helfer, Gerät Handy)“).
 *
 * - An den Server geht ein sprachneutraler Schlüssel (`phone` | `tablet` | `computer`) als `p_device_label` (Review #331
 *   M-3): der Wert bleibt in den Daten, die Anzeige übersetzt erst beim Lesen (`common:deviceKind.*`, DE/EN).
 * - Ältere oder fremde Werte (freier Text) zeigt die Anzeige so, wie sie gespeichert sind.
 * - `deviceKind` ist rein: der Aufrufer reicht `navigator.userAgent` und `navigator.maxTouchPoints` hinein.
 *
 * Genutzt von A-17a (Beitritt), A-18a/A-18b (Übersicht, Verlauf), B-21 (Monitor) und B-49 (Steuer-Anzeige).
 */
import i18next from 'i18next';

export const DEVICE_KINDS = ['phone', 'tablet', 'computer'] as const;
export type DeviceKind = (typeof DEVICE_KINDS)[number];

/**
 * Geräteart aus dem User-Agent. iPadOS meldet sich seit Version 13 als „Macintosh“; ein Mac mit Touch-Punkten ist deshalb
 * ein iPad. Android-Tablets lassen „Mobile“ weg.
 */
export function deviceKind(userAgent: string, maxTouchPoints = 0): DeviceKind {
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|kindle|silk|playbook/.test(ua)) {
    return 'tablet';
  }
  if (/iphone|ipod|windows phone|blackberry|opera mini|mobile/.test(ua)) {
    return 'phone';
  }
  if (ua.includes('android')) {
    return 'tablet';
  }
  if (ua.includes('macintosh') && maxTouchPoints > 1) {
    return 'tablet';
  }
  return 'computer';
}

/** Wert für `p_device_label`: der sprachneutrale Schlüssel der Geräteart. */
export function deviceLabel(userAgent: string, maxTouchPoints = 0): DeviceKind {
  return deviceKind(userAgent, maxTouchPoints);
}

function isDeviceKind(value: string): value is DeviceKind {
  return DEVICE_KINDS.some((kind) => kind === value);
}

/** Rein: Übersetzungsschlüssel für bekannte Schlüssel, sonst der gespeicherte Text; nichts gespeichert → `null`. */
export function describeDeviceLabel(stored: string | null | undefined): { key: `common:deviceKind.${DeviceKind}` } | { text: string } | null {
  const value = stored?.trim() ?? '';
  if (value === '') {
    return null;
  }
  return isDeviceKind(value) ? { key: `common:deviceKind.${value}` } : { text: value };
}

/** Anzeige der gespeicherten Gerätebezeichnung in der aktuellen (oder angegebenen) Sprache. */
export function deviceLabelText(stored: string | null | undefined, locale?: 'de' | 'en'): string | null {
  const description = describeDeviceLabel(stored);
  if (description === null) {
    return null;
  }
  return 'text' in description ? description.text : i18next.t(description.key, locale ? { lng: locale } : {});
}
