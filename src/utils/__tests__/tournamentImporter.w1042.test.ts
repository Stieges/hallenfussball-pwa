/**
 * @W1-042 Fehlt in der Import-Datei das Datum oder die Startzeit, meldet die App das, statt still „heute“ bzw. 09:00
 * einzusetzen (docs/anforderungen/2026-09-27_wizard-einstieg-und-fuehrung.md). Befund C-IMPORT-PFLICHTFELDER-STILL.
 * Gegeben eine Import-Datei des „Nikolaus-Turniers F2“, in der <Feld> fehlt – wenn die Turnierleitung sie importiert,
 * nennt die App „<Meldung>“, und es entsteht kein Turnier mit einem erfundenen Wert.
 * Echter Weg: JSON-Text → `validateAndParseTournamentImport`.
 */
import { describe, it, expect } from 'vitest';
import { validateAndParseTournamentImport } from '../tournamentImporter';
import { JSON_TEMPLATE } from '../../components/dialogs/ImportTemplates';

const vollstaendig = {
  title: 'Nikolaus-Turnier F2',
  date: '2026-11-28',
  startTime: '09:30',
  teams: [{ id: 't1', name: 'TSV Waging rot' }, { id: 't2', name: 'DJK Kammer' }],
};

const ohne = (...felder: string[]): string =>
  JSON.stringify(Object.fromEntries(Object.entries(vollstaendig).filter(([name]) => !felder.includes(name))));

describe('@W1-042 Import meldet fehlendes Datum oder Startzeit', () => {
  it.each([
    { feld: 'Datum', fehlt: ['date'], code: 'MISSING_DATE', meldung: 'In der Datei fehlt das Turnierdatum' },
    { feld: 'Startzeit', fehlt: ['startTime'], code: 'MISSING_START_TIME', meldung: 'In der Datei fehlt die Startzeit des Turniers' },
  ])('$feld fehlt: Meldung im Klartext, kein Turnier, kein erfundener Wert', ({ fehlt, code, meldung }) => {
    const result = validateAndParseTournamentImport(ohne(...fehlt), 'json');

    expect(result.isValid).toBe(false);
    expect(result.tournament).toBeUndefined();
    expect(result.errors).toEqual([expect.objectContaining({ code, message: meldung })]);
  });

  it('beide fehlen: beide Meldungen auf einmal', () => {
    const result = validateAndParseTournamentImport(ohne('date', 'startTime'), 'json');

    expect(result.isValid).toBe(false);
    expect(result.tournament).toBeUndefined();
    expect(result.errors.map((e) => e.code)).toEqual(['MISSING_DATE', 'MISSING_START_TIME']);
  });

  it.each([
    { art: 'leerer Text', wert: '' },
    { art: 'nur Leerzeichen', wert: '   ' },
    { art: 'keine Zeichenkette', wert: 0 },
  ])('Gegenbeispiel: $art gilt als fehlend (Datum und Startzeit)', ({ wert }) => {
    const result = validateAndParseTournamentImport(
      JSON.stringify({ ...vollstaendig, date: wert, startTime: wert }),
      'json',
    );

    expect(result.isValid).toBe(false);
    expect(result.errors.map((e) => e.code)).toEqual(['MISSING_DATE', 'MISSING_START_TIME']);
  });

  it('Gegenbeispiel: vollständige Datei bleibt gültig und übernimmt Datum und Startzeit der Datei', () => {
    const result = validateAndParseTournamentImport(JSON.stringify(vollstaendig), 'json');

    expect(result.isValid).toBe(true);
    expect(result.tournament).toMatchObject({ date: '2026-11-28', startDate: '2026-11-28', startTime: '09:30' });
  });

  it('Gegenbeispiel: die älteren Feldnamen startDate und timeSlot zählen weiter als Datum und Startzeit', () => {
    const result = validateAndParseTournamentImport(
      JSON.stringify({ title: 'Alt', teams: vollstaendig.teams, startDate: '2026-11-29', timeSlot: '10:15' }),
      'json',
    );

    expect(result.isValid).toBe(true);
    expect(result.tournament).toMatchObject({ date: '2026-11-29', startDate: '2026-11-29', timeSlot: '10:15', startTime: '10:15' });
  });

  it('Fehlt außerdem der Turniername, stehen alle Meldungen gemeinsam da', () => {
    const result = validateAndParseTournamentImport(JSON.stringify({ teams: vollstaendig.teams }), 'json');

    expect(result.errors.map((e) => e.code)).toEqual(['MISSING_TITLE', 'MISSING_DATE', 'MISSING_START_TIME']);
  });

  it('Gegenbeispiel: die JSON-Vorlage aus dem Import-Dialog trägt Datum und Startzeit und bleibt importierbar', () => {
    const result = validateAndParseTournamentImport(JSON.stringify(JSON_TEMPLATE), 'json');

    expect(result.errors).toEqual([]);
    expect(result.isValid).toBe(true);
    expect(result.tournament).toMatchObject({ date: JSON_TEMPLATE.date, startTime: JSON_TEMPLATE.startTime });
  });
});
