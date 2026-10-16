/**
 * B-28 C5 – Sichtbarkeit im Spielplan-PDF (rein, ohne Dokument): @BM-032, @BM-054, @DR-018.
 * Schalter „Gruppentabellen“ = `!hideRankingsForPublic`, Ergebnisse nach `hideScoresForPublic`; beides gilt für jede
 * Zielgruppe und unabhängig davon, ob die öffentliche Ansicht läuft. Zuschauer sehen zusätzlich nur den Spielplan.
 * `isKidsTournament` wird nicht ausgewertet (Daniel 10.10.).
 */
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { generateLiveUrl } from '../../../utils/shareUtils';
import { pdfContentRules, type PdfContentSource } from '../visibility';

const BASE = 'https://hallenfussball.example';
const quelle = (overrides: Partial<PdfContentSource> = {}): PdfContentSource => ({
  hideScoresForPublic: false,
  hideRankingsForPublic: false,
  isKidsTournament: false,
  isPublic: true,
  shareCode: 'ABC123',
  ...overrides,
});

describe('@BM-032 @BM-054 Matrix der Schalter × Zielgruppe', () => {
  it.each([
    ['Veranstalter, alles sichtbar', 'organizer', {}, { results: true, tables: true, hidePendingOrigin: false }],
    ['Veranstalter, Ergebnisse ausgeblendet', 'organizer', { hideScoresForPublic: true }, { results: false, tables: true, hidePendingOrigin: false }],
    ['Veranstalter, Gruppentabellen aus', 'organizer', { hideRankingsForPublic: true }, { results: true, tables: false, hidePendingOrigin: true }],
    ['Veranstalter, beides aus', 'organizer', { hideScoresForPublic: true, hideRankingsForPublic: true }, { results: false, tables: false, hidePendingOrigin: true }],
    ['Zuschauer, Schalter an: nur Spielplan', 'viewer', {}, { results: false, tables: false, hidePendingOrigin: true }],
    ['Zuschauer, beides aus', 'viewer', { hideScoresForPublic: true, hideRankingsForPublic: true }, { results: false, tables: false, hidePendingOrigin: true }],
  ] as const)('%s', (_name, audience, schalter, erwartet) => {
    const rules = pdfContentRules(quelle(schalter), audience, BASE);

    expect(rules.results).toBe(erwartet.results);
    expect(rules.tables).toBe(erwartet.tables);
    expect(rules.hidePendingOrigin).toBe(erwartet.hidePendingOrigin);
  });

  it('gilt unabhängig davon, ob die öffentliche Ansicht läuft', () => {
    const privat = pdfContentRules(quelle({ isPublic: false, shareCode: undefined, hideScoresForPublic: true, hideRankingsForPublic: true }), 'organizer');

    expect(privat.results).toBe(false);
    expect(privat.tables).toBe(false);
    expect(privat.qrUrl).toBeNull();
  });

  it('Gegenbeispiel: Kindermodus wird nicht ausgewertet', () => {
    const kinder = pdfContentRules(quelle({ isKidsTournament: true }), 'organizer', BASE);

    expect(kinder).toEqual(pdfContentRules(quelle({ isKidsTournament: false }), 'organizer', BASE));
    expect(kinder.results).toBe(true);
    expect(kinder.tables).toBe(true);
  });
});

describe('@BM-043 qrUrl', () => {
  it('geteilt: die Adresse des Teilen-Links', () => {
    expect(pdfContentRules(quelle(), 'organizer', BASE).qrUrl).toBe(generateLiveUrl('ABC123', BASE));
  });

  it('Gegenbeispiel: nicht geteilt ergibt keine Adresse', () => {
    expect(pdfContentRules(quelle({ isPublic: false }), 'viewer', BASE).qrUrl).toBeNull();
  });
});
