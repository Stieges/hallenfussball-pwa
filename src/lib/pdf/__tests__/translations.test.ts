/**
 * Texte und Formate des Spielplan-PDFs (B-28a2 Fixrunde, F2/F7/F8): Phasentitel, Gruppennamen, Spieltag-Datum,
 * Feldnamen der Hinweise. Mit der echten Ressource über `pdfText.ts`.
 */
import { describe, expect, it } from 'vitest';
import { buildPdfTexts, resolvePdfLocale } from '../translations';
import { translatorFor } from './pdfText';

const de = buildPdfTexts(translatorFor('de'), 'de');
const en = buildPdfTexts(translatorFor('en'), 'en');

describe('Spieltag-Datum über Intl (F7)', () => {
  it('DE: TT.MM.JJJJ', () => {
    expect(de.formatDate('2027-01-18')).toBe('18.01.2027');
  });
  it('EN: Intl in englischer Form', () => {
    expect(en.formatDate('2027-01-18')).toBe('01/18/2027');
  });
  it('ein Datum im Format TT.MM.JJJJ bleibt unverändert', () => {
    expect(en.formatDate('18.01.2027')).toBe('18.01.2027');
  });
});

describe('Phasentitel und Gruppennamen (F2)', () => {
  it.each([
    ['roundOf16', 'Achtelfinale', 'Round of 16'],
    ['quarterfinal', 'Viertelfinale', 'Quarter-finals'],
    ['semifinal', 'Halbfinale', 'Semi-finals'],
    ['final', 'Finalspiele', 'Finals'],
  ])('Phase %s: DE „%s“, EN „%s“', (name, german, english) => {
    expect(de.phaseTitle(name, 'Fallback')).toBe(german);
    expect(en.phaseTitle(name, 'Fallback')).toBe(english);
  });

  it('unbekannte Phase bleibt beim Namen aus dem Plan', () => {
    expect(en.phaseTitle('placement', 'Platzierung')).toBe('Platzierung');
  });

  it('generischer Gruppenname wird übersetzt, eigener Name bleibt', () => {
    expect(de.groupLabel('A', 'Gruppe A')).toBe('Gruppe A');
    expect(en.groupLabel('A', 'Gruppe A')).toBe('Group A');
    expect(en.groupLabel('A', 'Die Wilden')).toBe('Die Wilden');
  });
});

describe('Feldnamen der Hinweise (F8)', () => {
  it('nennt das Feld, aus dem der Text stammt', () => {
    expect(de.unrenderableField(de.hall, 'Ярославль Halle')).toBe(
      'Halle ‚Ярославль Halle‘ enthält Zeichen, die im PDF nicht dargestellt werden können',
    );
    expect(en.unrenderableField(en.tournamentTitle, 'Ярославль')).toBe(
      'Tournament name ‘Ярославль’ contains characters that cannot be shown in the PDF',
    );
  });
});

describe('Sprachwahl', () => {
  it('EN nur für en-Varianten, sonst Deutsch', () => {
    expect(resolvePdfLocale('en')).toBe('en');
    expect(resolvePdfLocale('en-US')).toBe('en');
    expect(resolvePdfLocale('de')).toBe('de');
    expect(resolvePdfLocale(undefined)).toBe('de');
  });
});
