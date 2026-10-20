/**
 * CA-5 / @HE-088 „… mit der Angabe „Co-Admin““: der Text der Marke steht wörtlich in den Sprachdateien,
 * Deutsch und Englisch mit denselben Schlüsseln (der Kartentest prüft nur die Schlüssel, i18n ist dort ein Passthrough).
 */
import { describe, it, expect } from 'vitest';
import de from '../../i18n/locales/de/dashboard.json';
import en from '../../i18n/locales/en/dashboard.json';

describe('CA-5 Marke der Rolle auf der Karte: Sprachdateien', () => {
  it('@HE-088 @HE-085 Deutsch: „Co-Admin“, dazu Helfer, Trainer, Zuschauer', () => {
    expect(de.card.role).toEqual({ 'co-admin': 'Co-Admin', collaborator: 'Helfer', trainer: 'Trainer', viewer: 'Zuschauer' });
  });

  it('Englisch: dieselben Schlüssel, übersetzt', () => {
    expect(en.card.role).toEqual({ 'co-admin': 'Co-admin', collaborator: 'Helper', trainer: 'Coach', viewer: 'Viewer' });
  });
});
