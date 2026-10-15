/**
 * Spieltag-Datum (B-28a2 Fixrunde, F7/R3) unter einer festen Zeitzone westlich von UTC.
 * Die Zeitzone ist hier fest gesetzt, damit der Test auf jedem Rechner dieselbe Aussage prüft: Ohne
 * `timeZone: 'UTC'` in `formatDate` würde das Datum unter America/Los_Angeles um einen Tag zurückspringen.
 */
import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.TZ = 'America/Los_Angeles';
});

import { buildPdfTexts } from '../translations';
import { translatorFor } from './pdfText';

const de = buildPdfTexts(translatorFor('de'), 'de');
const en = buildPdfTexts(translatorFor('en'), 'en');

describe('Spieltag-Datum zonenunabhängig (R3)', () => {
  it('Zeitzone ist America/Los_Angeles (Vorbedingung des Tests)', () => {
    expect(new Date(Date.UTC(2027, 0, 18, 2)).getDate()).toBe(17);
  });
  it('DE: 18.01.2027 bleibt am 18. (Mitternacht UTC wird nicht zum Vortag)', () => {
    expect(de.formatDate('2027-01-18')).toBe('18.01.2027');
  });
  it('EN: 01/18/2027 bleibt am 18.', () => {
    expect(en.formatDate('2027-01-18')).toBe('01/18/2027');
  });
});
