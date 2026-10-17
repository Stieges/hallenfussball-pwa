import { describe, it, expect, vi } from 'vitest';
vi.unmock('i18next');
vi.unmock('react-i18next');
import i18n from 'i18next';
import { initRealDeI18n } from '../realDeI18n';
await initRealDeI18n();

describe('realDeI18n (Werkzeug für Cockpit-Tests)', () => {
  it('liefert echte DE-Texte aus dem Namensraum cockpit', () => {
    expect(i18n.t('toast.foul', { ns: 'cockpit', teamName: 'SV Süd' })).toBe('Foul für SV Süd');
  });
  it('Gegenbeispiel: kein Schlüssel-Echo wie im globalen Passthrough-Mock', () => {
    expect(i18n.t('toast.foul', { ns: 'cockpit', teamName: 'SV Süd' })).not.toContain('cockpit:');
  });
});
