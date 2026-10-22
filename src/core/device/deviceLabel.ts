/**
 * Gerätebezeichnung für Helfer-Anfragen und Steuer-Anzeige (Plan GA5 v2.1 R-GA5-9, Review S3; @HE-049 „Feld 2: Tom (Handy)“,
 * @HE-081 „Tom (Helfer, Gerät Handy)“). Rein: der Aufrufer reicht `navigator.userAgent` und `navigator.maxTouchPoints` hinein.
 * Die Bezeichnung geht als `p_device_label` an den Server (der kürzt auf 40 Zeichen und entfernt Steuerzeichen) und wird
 * der Turnierleitung angezeigt; sie ist deshalb ein fester, kurzer Begriff und keine Geräte-Kennung.
 *
 * Genutzt von A-17a (Beitritt), B-21 (Monitor) und B-49 (Steuer-Anzeige).
 */

export type DeviceKind = 'phone' | 'tablet' | 'computer';

/** Anzeige der Geräteart wie im Mockup M-GA5 („Handy“, „Tablet“, „Laptop“). */
export const DEVICE_LABELS: Readonly<Record<DeviceKind, string>> = {
  phone: 'Handy',
  tablet: 'Tablet',
  computer: 'Laptop',
};

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

/** Bezeichnung für `p_device_label`. */
export function deviceLabel(userAgent: string, maxTouchPoints = 0): string {
  return DEVICE_LABELS[deviceKind(userAgent, maxTouchPoints)];
}
