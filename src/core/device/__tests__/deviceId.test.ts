/**
 * Geräte-ID (B-49): stabil je Gerät, dauerhaft gespeichert, mit Fallback ohne Speicher.
 * Szenarien: @FU-026 (das steuernde Gerät ist am Server erkennbar), @FU-030 (genau ein Gerät steuert).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { DEVICE_ID_STORAGE_KEY, getDeviceId, resetDeviceIdCacheForTests, type DeviceIdStorage } from '../deviceId';

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

function memory(initial: Record<string, string> = {}): DeviceIdStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => { data[key] = value; },
  };
}

beforeEach(() => {
  resetDeviceIdCacheForTests();
});

describe('Geräte-ID (B-49)', () => {
  it('@FU-026 erzeugt einmal eine UUID und legt sie dauerhaft ab', () => {
    const storage = memory();
    expect(getDeviceId(storage, () => UUID_A)).toBe(UUID_A);
    expect(storage.data[DEVICE_ID_STORAGE_KEY]).toBe(UUID_A);
  });

  it('@FU-026 nach dem Neuladen (neuer Modulzustand) gilt dieselbe gespeicherte ID', () => {
    const storage = memory({ [DEVICE_ID_STORAGE_KEY]: UUID_A });
    expect(getDeviceId(storage, () => UUID_B)).toBe(UUID_A);
  });

  it('@FU-030 Gegenbeispiel: zwei Geräte (zwei Speicher) bekommen verschiedene IDs', () => {
    const tom = getDeviceId(memory(), () => UUID_A);
    resetDeviceIdCacheForTests();
    const clara = getDeviceId(memory(), () => UUID_B);
    expect(tom).not.toBe(clara);
  });

  it('ein ungültiger gespeicherter Wert wird durch eine neue UUID ersetzt (der Server erwartet uuid)', () => {
    const storage = memory({ [DEVICE_ID_STORAGE_KEY]: 'kaputt' });
    expect(getDeviceId(storage, () => UUID_B)).toBe(UUID_B);
    expect(storage.data[DEVICE_ID_STORAGE_KEY]).toBe(UUID_B);
  });

  it('Fallback: gesperrter Speicher – die ID bleibt für die Laufzeit der Seite gleich, ohne Fehler', () => {
    const gesperrt: DeviceIdStorage = {
      getItem: () => { throw new Error('SecurityError'); },
      setItem: () => { throw new Error('SecurityError'); },
    };
    let n = 0;
    const neu = () => (n++ === 0 ? UUID_A : UUID_B);
    expect(getDeviceId(gesperrt, neu)).toBe(UUID_A);
    expect(getDeviceId(gesperrt, neu)).toBe(UUID_A);
  });

  it('ohne Argumente: Standard-Speicher, im UUID-Format', () => {
    expect(getDeviceId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
