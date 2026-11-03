/**
 * Adresszeile „Straße, PLZ Ort“ (PDF @DR-031 und Vorschau): die PLZ steht nur zusammen mit dem Ort, nie allein; fehlt eine Angabe,
 * fällt sie samt Komma weg.
 */
import { describe, expect, it } from 'vitest';
import { getLocationAddressLine } from '../locationHelpers';

const line = (location: Parameters<typeof getLocationAddressLine>[0]['location']): string => getLocationAddressLine({ location });

describe('getLocationAddressLine', () => {
  it('Straße, PLZ Ort', () => {
    expect(line({ name: 'Halle', street: 'Mühlberger Weg 5', postalCode: '83329', city: 'Waging am See' })).toBe('Mühlberger Weg 5, 83329 Waging am See');
  });

  it('ohne PLZ: Straße, Ort', () => {
    expect(line({ name: 'Halle', street: 'Mozartstraße 9', city: 'Waging am See' })).toBe('Mozartstraße 9, Waging am See');
  });

  it('Gegenbeispiel: eine PLZ ohne Ort steht nie allein', () => {
    expect(line({ name: 'Halle', street: 'Mozartstraße 9', postalCode: '83329' })).toBe('Mozartstraße 9');
    expect(line({ name: 'Halle', postalCode: '83329' })).toBe('');
  });

  it('ohne Straße nur PLZ Ort, ohne Angaben leer', () => {
    expect(line({ name: 'Halle', postalCode: '83329', city: 'Waging am See' })).toBe('83329 Waging am See');
    expect(line({ name: 'Halle' })).toBe('');
    expect(line(undefined)).toBe('');
  });
});
