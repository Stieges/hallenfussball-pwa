/**
 * @ZM-212 Das Darstellungsprofil eines Monitors liegt im selben JSON wie die übrigen Einstellungen (Feld `profile`, keine Migration).
 * Ein unbekannter Wert (z. B. aus einer neueren Fassung) darf nichts brechen: er gilt als „nicht gesetzt“ (bisherige Darstellung).
 */
import { describe, it, expect } from 'vitest';
import { MONITOR_PROFILES, monitorProfileOf } from '../monitor';

describe('@ZM-212 monitorProfileOf', () => {
  it('„Halle (sehr fern)“ wird erkannt', () => {
    expect(monitorProfileOf({ profile: 'hall-very-far' })).toBe('hall-very-far');
    expect(MONITOR_PROFILES).toContain('hall-very-far');
  });

  it('Gegenbeispiele: fehlender Wert, leerer Text, unbekannter Text, Zahl, Objekt und kein Monitor gelten als nicht gesetzt', () => {
    expect(monitorProfileOf({})).toBeUndefined();
    expect(monitorProfileOf({ profile: '' })).toBeUndefined();
    expect(monitorProfileOf({ profile: 'zukunft-profil' })).toBeUndefined();
    expect(monitorProfileOf({ profile: 'HALL-VERY-FAR' })).toBeUndefined(); // genau der gespeicherte Wert zählt
    expect(monitorProfileOf({ profile: 1 })).toBeUndefined();
    expect(monitorProfileOf({ profile: { kind: 'hall-very-far' } })).toBeUndefined();
    expect(monitorProfileOf(null)).toBeUndefined();
    expect(monitorProfileOf(undefined)).toBeUndefined();
  });

  it('ein bestehender Monitor ohne das Feld ist unverändert lesbar (alte Konfiguration aus dem JSON)', () => {
    const gespeichert: unknown = JSON.parse('{"id":"mon-1","name":"Haupthalle","theme":"dark","slides":[]}');
    expect(monitorProfileOf(gespeichert as { profile?: unknown })).toBeUndefined();
  });
});
