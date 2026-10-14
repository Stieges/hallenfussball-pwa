/**
 * Weg über die App-Sprache mit echtem i18next (B-28a2 Fixrunde F6): Aufrufer übergeben weder `locale` noch
 * `translate` (so wie Dialog und Vorschau es heute tun). Die globale Mock-Ersetzung der Testumgebung wird für
 * diese Datei aufgehoben.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import i18next from 'i18next';
import deTournament from '../../../i18n/locales/de/tournament.json';
import enTournament from '../../../i18n/locales/en/tournament.json';
import { generateFullSchedule } from '../../../core/generators';
import { buildSchedulePdf } from '../schedulePdf';
import { hallencupTournament } from './pdfFixture';
import { extractPdfText, pdfLanguage } from './pdfjsText';

vi.unmock('i18next');

// Mitschnitt aus pdfCapture ist hier nicht nötig: das PDF wird über pdfjs gelesen.

beforeAll(async () => {
  await i18next.init({
    lng: 'de',
    fallbackLng: 'de',
    ns: ['tournament'],
    defaultNS: 'tournament',
    resources: { de: { tournament: deTournament }, en: { tournament: enTournament } },
    interpolation: { escapeValue: false },
  });
});

async function build(): Promise<Uint8Array> {
  const schedule = generateFullSchedule(hallencupTournament(), 'de');
  const { doc } = await buildSchedulePdf({ schedule, standings: undefined, options: {} });
  return new Uint8Array(doc.output('arraybuffer'));
}

describe('App-Sprache ohne explizite Optionen', () => {
  it('Sprache der App: Deutsch', async () => {
    await i18next.changeLanguage('de');
    const bytes = await build();
    expect(pdfLanguage(bytes)).toBe('de');
    const text = (await extractPdfText(bytes)).pages.flat().join(' ');
    expect(text).toContain('Gruppenphase');
  });

  it('App auf Englisch: /Lang en und englische Titel', async () => {
    await i18next.changeLanguage('en');
    const bytes = await build();
    expect(pdfLanguage(bytes)).toBe('en');
    const text = (await extractPdfText(bytes)).pages.flat().join(' ');
    expect(text).toContain('Group stage');
    expect(text).not.toContain('Gruppenphase');
    await i18next.changeLanguage('de');
  });
});
