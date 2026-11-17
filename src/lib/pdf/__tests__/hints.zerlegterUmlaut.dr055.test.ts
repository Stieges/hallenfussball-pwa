/**
 * @DR-055 Ein zerlegt gespeicherter Umlaut („u“ + U+0308) löst keine Warnung aus: gemeldet wird nur, was nach der
 * Aufbereitung (`printable`) wirklich als „?“ gedruckt wird. Ein echtes nicht druckbares Zeichen im selben Text bleibt gemeldet (@DR-012).
 */
import { describe, expect, it } from 'vitest';
import { isPdfGlyph } from '../fonts';
import { buildHints, hintNotes, NO_HINTS } from '../notes';
import { printable } from '../printable';
import { buildSchedulePdf } from '../schedulePdf';
import { buildPdfTexts } from '../translations';
import { hallencupSchedule, hallencupTournament } from './pdfFixture';
import { translatorFor } from './pdfText';

const ZERLEGT = 'Richtlinie für private Hallenturniere';
const GESETZT = 'Richtlinie für private Hallenturniere';
const mode = { fallback: false, covers: isPdfGlyph };
const de = buildPdfTexts(translatorFor('de'), 'de');

describe('@DR-055 zerlegter Umlaut', () => {
  it('der Text ist wirklich zerlegt, und gedruckt wird der richtige Umlaut', () => {
    expect(ZERLEGT).not.toBe(GESETZT);
    expect(printable(ZERLEGT)).toBe(GESETZT);
  });

  it('Regelwerk und Teamname mit zerlegtem Umlaut: keine Hinweise', () => {
    const hints = buildHints({ fields: [['Regelwerk', ZERLEGT]], teamNames: ['SV München'], mode, logoFailures: [] });

    expect(hints).toEqual(NO_HINTS);
  });

  it('am Spielplan: Regelwerk mit zerlegtem Umlaut gibt weder hints noch notes', async () => {
    const tournament = Object.assign(hallencupTournament(), { rulebook: ZERLEGT });
    const result = await buildSchedulePdf({
      schedule: hallencupSchedule(tournament),
      standings: undefined,
      options: { locale: 'de', translate: translatorFor('de'), tournament, now: new Date(2026, 10, 14, 15, 7) },
    });

    expect(result.hints.fields).toEqual([]);
    expect(result.notes).toEqual([]);
  });

  it('Gegenbeispiel: zerlegter Umlaut plus Emoji im selben Text: gemeldet, gedruckt mit richtigem „ü“ und genau einem „?“', () => {
    const hints = buildHints({ fields: [['Regelwerk', `${ZERLEGT} ⚽`]], teamNames: [], mode, logoFailures: [] });

    expect(hints.fields.map(f => f.printed)).toEqual([`${GESETZT} ?`]);
    expect(hintNotes(hints, de)).toHaveLength(1);
  });

  it('Gegenbeispiel: ein lose stehender Kombinierpunkt-Akzent ohne Grundbuchstaben wird weiter gemeldet', () => {
    const hints = buildHints({ fields: [['Regelwerk', 'Regeln ̈']], teamNames: [], mode, logoFailures: [] });

    expect(hints.fields).toHaveLength(1);
    expect(hints.fields[0].printed).toBe('Regeln ?');
  });
});
