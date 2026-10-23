/**
 * Stabile Geräte-ID (B-49, Befund C-HELFER-FELD-OHNE-SPERRE): Die Steuer je Feld am Server (A-34, `20261110_003`) erkennt das
 * steuernde Gerät an Konto bzw. Gerätesitzung UND Geräte-ID. Ohne Geräte-ID entsteht kein Anspruch, die Sperre greift nicht.
 *
 * - Einmal je Gerät erzeugt (UUID wie `match_events.id`), dauerhaft in `localStorage` (über `safeLocalStorage`).
 * - Fallback: Ist der Speicher gesperrt (privates Fenster, `SecurityError`), gilt die ID für die Laufzeit der Seite
 *   (Zwischenspeicher im Modul). Ein Neuladen ergibt dann ein neues Gerät -- es steuert nichts mehr, die Turnierleitung
 *   übernimmt („Spielleitung übernehmen“, @FU-027).
 * - Ein ungültiger gespeicherter Wert (kein UUID-Format) wird ersetzt, damit der Server (`uuid`) ihn nicht ablehnt.
 *
 * Genutzt von `OutboxSender` (`append_match_events`, `p_device_id`), `field_control_state` und `take_field_control`.
 * Szenarien: @FU-026, @FU-027, @FU-030, @HE-049.
 */
import { safeLocalStorage } from '../utils/safeStorage';
import { generateEventId, isUuidFormat } from '../utils/id';

export const DEVICE_ID_STORAGE_KEY = 'hallenfussball:deviceId';

/** Der Teil des Speichers, den die Geräte-ID braucht. */
export type DeviceIdStorage = Pick<Storage, 'getItem' | 'setItem'>;

let cached: string | null = null;

function readStored(storage: DeviceIdStorage): string | null {
  try {
    const value = storage.getItem(DEVICE_ID_STORAGE_KEY);
    return value !== null && isUuidFormat(value) ? value.toLowerCase() : null;
  } catch {
    return null;
  }
}

/** Geräte-ID dieses Geräts; erzeugt sie beim ersten Aufruf und legt sie ab. */
export function getDeviceId(storage: DeviceIdStorage = safeLocalStorage, newId: () => string = generateEventId): string {
  if (cached !== null) {
    return cached;
  }
  const stored = readStored(storage);
  if (stored !== null) {
    cached = stored;
    return stored;
  }
  const created = newId().toLowerCase();
  try {
    storage.setItem(DEVICE_ID_STORAGE_KEY, created);
  } catch {
    // Speicher gesperrt: die ID gilt bis zum Neuladen (Zwischenspeicher oben)
  }
  cached = created;
  return created;
}

/** Nur für Tests: Zwischenspeicher leeren (der nächste Aufruf liest den Speicher neu). */
export function resetDeviceIdCacheForTests(): void {
  cached = null;
}
