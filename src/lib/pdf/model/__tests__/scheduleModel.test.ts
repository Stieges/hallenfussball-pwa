/**
 * Seitenmodell des Spielplans (T6): @DR-002 (Reihenfolge, Folgeseite, Querformat), @DR-025 (Spalte „SR“), @DR-032/@DR-033
 * (Namen und Reserve-Regel), @DR-019 (Zustände), @DR-039 (Titel und Sprache der Datei). Fake-Messfunktion 2,0 / 2,2 mm je Zeichen;
 * je Modul ein Abgleichtest mit dem echten jsPDF-Adapter und der Schrift aus T1.
 */
import { jsPDF } from 'jspdf';
import { describe, expect, it } from 'vitest';
import { printLimits, printUnit } from '../../../../design-tokens/print';
import { printMatchRow } from '../../../../design-tokens/print-sheet';
import { fontOf, registerPdfFonts } from '../../fonts';
import { refereeLabelFor } from '../../refereeLabel';
import { FALL_A, FALL_B, FALL_C, fallBLang, mitStandA } from '../../__tests__/fixtures/handzettelFaelle';
import { jspdfMeasure } from '../measure';
import type { MatchRowModel, MatchRowsBlock, ScheduleModel } from '../types';
import { modelOf } from './modelSupport';

const blocksOf = (model: ScheduleModel): MatchRowsBlock[] => model.pages.flatMap(p => p.blocks.filter((b): b is MatchRowsBlock => b.kind === 'matchRows'));
const rowsOf = (model: ScheduleModel): MatchRowModel[] => blocksOf(model).flatMap(b => b.rows);
const allText = (model: ScheduleModel): string[] =>
  rowsOf(model).flatMap(r => [...r.home.runs, ...r.away.runs, ...r.cell.runs, ...(r.referee ?? [])].map(t => t.text));

describe('@DR-002 Seiten der Gruppenspiele', () => {
  it('@DR-002 eine eigene Liste der Teilnehmer gibt es nicht: jeder Teamname steht nur in seinen Spielen', () => {
    const { model, t } = modelOf(FALL_A);
    const names = allText(model).filter(text => text === 'DJK Kammer');

    expect(allText(model)).not.toContain(t.participants);
    expect(names).toHaveLength(5);
  });

  it('@DR-002 Seite 1 trägt Kopf und Spaltenkopf, alle Spiele stehen darunter', () => {
    const { model } = modelOf(FALL_A);

    expect(model.pages).toHaveLength(1);
    expect(model.pages[0].blocks.map(b => b.kind)).toEqual(['header', 'matchRows']);
    expect(rowsOf(model).map(r => r.number)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
  });

  it('@DR-002 Folgeseite mit wiederholtem Spaltenkopf, wenn die Spiele nicht auf Seite 1 passen', () => {
    const { model } = modelOf(fallBLang(2), { geo: g => ({ ...g, bottom: g.bottom - 40 }) });
    const [first, second] = blocksOf(model);

    expect(model.fit).toBe('nextPage');
    expect(model.pages.length).toBeGreaterThanOrEqual(2);
    expect(second.head.labels.map(l => l.text)).toEqual(first.head.labels.map(l => l.text));
    expect(model.pages[1].blocks.map(b => b.kind)).toEqual(['matchRows']);
    expect(rowsOf(model).map(r => r.number)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it('@DR-033 Folgeseite: mindestens 3 Spiele (Beispiel 3)', () => {
    const { model } = modelOf(fallBLang(2), { geo: g => ({ ...g, bottom: g.bottom - 40 }) });

    expect(blocksOf(model).at(-1)!.rows.length).toBeGreaterThanOrEqual(printMatchRow.minRowsOnNextPage);
  });

  it('@DR-002 Querformat angefordert: es entsteht trotzdem A4 hoch (MVP+, @DR-026)', () => {
    const portrait = modelOf(FALL_A);
    const landscape = modelOf(FALL_A, { options: { orientation: 'landscape' } });

    expect(landscape.model.format).toBe('a4-portrait');
    expect(landscape.model).toEqual(portrait.model);
  });
});

/** Zeilen eines Namens wieder zusammengesetzt: nach „/“ und „-“ ohne Leerzeichen, sonst mit. */
const unwrapped = (lines: string[]): string => lines.join(' ').replace(/([/-]) /g, '$1');

function lineHeightFactor(row: MatchRowModel): number {
  const [a, b] = row.home.runs.length > 1 ? row.home.runs : row.away.runs;
  return (b.y - a.y) / (a.pt * printUnit.mmPerPt);
}

describe('@DR-033 Reserve-Regel bei Platzmangel', () => {
  it('@DR-033 Beispiel 2: eng gesetzt bleibt auf Seite 1, die Schrift wird nicht kleiner', () => {
    const { model } = modelOf(fallBLang(2));

    expect(model.fit).toBe('tight');
    expect(model.pages).toHaveLength(1);
    for (const r of rowsOf(model)) { for (const run of [...r.home.runs, ...r.away.runs]) { expect(run.pt).toBeGreaterThanOrEqual(printLimits.teamPt); } }
  });

  it('@DR-033 passt alles, bleibt es beim normalen Polster', () => {
    expect(modelOf(FALL_B).model.fit).toBe('normal');
    expect(modelOf(fallBLang(1)).model.fit).toBe('normal');
  });

  it('@DR-033 der Zeilenabstand mehrzeiliger Namen sinkt in keiner Stufe unter das 1,15-Fache', () => {
    for (const { model } of [modelOf(fallBLang(1)), modelOf(fallBLang(2)), modelOf(fallBLang(2), { geo: g => ({ ...g, bottom: g.bottom - 40 }) })]) {
      const multi = rowsOf(model).filter(r => r.home.runs.length > 1 || r.away.runs.length > 1);
      expect(multi.length).toBeGreaterThan(0);
      for (const row of multi) { expect(lineHeightFactor(row)).toBeGreaterThanOrEqual(printMatchRow.lineHeight - 1e-9); }
    }
  });

  it('@DR-033 kein Teamname wird mit „…“ oder auf andere Weise gekürzt', () => {
    const { model, schedule } = modelOf(fallBLang(2));
    const gespielt = schedule.phases.find(p => p.name === 'groupStage')!.matches;

    expect(allText(model).join('')).not.toContain('…');
    for (const row of rowsOf(model)) {
      const match = gespielt.find(m => m.id === row.matchId)!;
      expect(unwrapped(row.home.name)).toBe(match.homeTeam);
      expect(unwrapped(row.away.name)).toBe(match.awayTeam);
    }
  });

  it.todo('@DR-033:teil Kurzname ersetzt den Namen (Paket Kurznamen nach dem Turnier, Plan PDF-Paket L8)');
});

describe('@DR-025 Spalte „SR“', () => {
  it('@DR-025 Nummer eingetragen: „2“; Personenname dazu: trotzdem die Nummer, nie der Name', () => {
    const { model } = modelOf(FALL_C);
    const referee = rowsOf(model).flatMap(r => (r.referee ?? []).map(x => x.text));

    expect(referee.slice(0, 3)).toEqual(['1', '2', '3']);
    expect(referee.join(' ')).not.toMatch(/Paul|Schmidt|Aylin|Müller/);
  });

  it('@DR-025 das Team pfeift: der Teamname steht dort', () => {
    const label = refereeLabelFor({ refereeConfig: { mode: 'teams' }, teams: [{ id: 't1', name: 'FC Nord' }, { id: 't2', name: 'SV Süd' }] });

    expect(label({ referee: 2 } as never)).toBe('SV Süd');
  });

  it('@DR-025 Nummer 3 mit dem Namen Paul Schmidt eingetragen: „3“', () => {
    const label = refereeLabelFor({ refereeConfig: { mode: 'organizer', refereeNames: { 3: 'Paul Schmidt' } }, teams: [] });

    expect(label({ referee: 3 } as never)).toBe('3');
  });

  it('@DR-025 nichts eingetragen: nichts', () => {
    expect(refereeLabelFor({ refereeConfig: { mode: 'organizer' }, teams: [] })({} as never)).toBe('');
  });

  it('@DR-025 mit Einträgen hat jedes Spiel die Spalte „SR“, ohne jeden Eintrag keine', () => {
    const mit = blocksOf(modelOf(FALL_C).model)[0];
    const ohne = blocksOf(modelOf(FALL_A).model)[0];

    expect(mit.head.columns.map(c => c.key)).toContain('referee');
    expect(mit.head.labels.map(l => l.text)).toContain('SR');
    expect(ohne.head.columns.map(c => c.key)).not.toContain('referee');
    expect(ohne.rows.every(r => r.referee === undefined)).toBe(true);
  });
});

describe('@DR-019 Zustände im Modell', () => {
  const opts = { options: { includeScores: true } };

  it('@DR-019 läuft und Halbzeit: „läuft“ mit Linien; beendet: Ergebnis; ausgefallen: „ausgefallen“ ohne Linien', () => {
    const live = rowsOf(modelOf(mitStandA(), opts).model);
    const half = rowsOf(modelOf(mitStandA(FALL_A, true), opts).model);

    expect(live[6].cell).toMatchObject({ kind: 'lines', live: true });
    expect(half[6].cell).toMatchObject({ kind: 'lines', live: true });
    expect(live[0].cell).toMatchObject({ kind: 'score', a: '2', b: '1' });
    expect(live[5].cell).toMatchObject({ kind: 'text', text: 'ausgefallen' });
    expect(live[5].lines).toEqual([]);
  });

  it('@DR-019 „ausgefallen“ steht auch bei ausgeblendeten Ergebnissen, aber nicht in der Fassung ohne Ergebnisse', () => {
    const hidden = rowsOf(modelOf(mitStandA(), { options: { includeScores: true }, tournament: { hideScoresForPublic: true } }).model);
    const blank = rowsOf(modelOf(mitStandA(), { options: { edition: 'blank', includeScores: true } }).model);

    expect(hidden[5].cell.kind).toBe('text');
    expect(hidden[0].cell).toMatchObject({ kind: 'lines', live: false });
    expect(blank[5].cell).toMatchObject({ kind: 'lines', live: false });
    expect(blank[0].lines).toHaveLength(2);
  });

  it('Gegenbeispiel @DR-019 die Fassung ohne Ergebnisse hat kein „läuft“, nur Linien', () => {
    const blank = rowsOf(modelOf(mitStandA(), { options: { edition: 'blank', includeScores: true } }).model);

    expect(blank.some(r => r.cell.runs.some(x => x.text === 'läuft'))).toBe(false);
  });
});

describe('@DR-039 Eigenschaften der Datei', () => {
  it('@DR-039 Titel „Nikolaus-Turnier – Spielplan“ (mit U+2013) und Sprache Deutsch', () => {
    const { model } = modelOf(FALL_A);

    expect(model.meta).toEqual({ title: 'Nikolaus-Turnier – Spielplan', lang: 'de' });
  });

  it('@DR-039 englische App: Titel „… – Schedule“, Sprache Englisch', () => {
    const { model } = modelOf(FALL_A, { locale: 'en' });

    expect(model.meta).toEqual({ title: 'Nikolaus-Turnier – Schedule', lang: 'en' });
  });
});

describe('Abgleich mit der echten Schrift (jsPDF-Adapter, T1)', () => {
  it('@DR-033 mit Inter statt der Fake-Messung: Fall b-lang mit einem langen Namen braucht die Stufe „eng“ und bleibt auf Seite 1', async () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    await registerPdfFonts(doc);
    const { model } = modelOf(fallBLang(1), { measure: jspdfMeasure(doc, fontOf(doc)) });

    expect(model.fit).toBe('tight');
    expect(model.pages).toHaveLength(1);
    expect(model.pages[0].blocks.map(b => b.kind)).toEqual(['header', 'matchRows']);
  });

  it('@DR-032 mit Inter: „SV Kirchanschöring“ passt in eine Zeile, der lange Name bricht nach „/“', async () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    await registerPdfFonts(doc);
    const rows = rowsOf(modelOf(fallBLang(1), { measure: jspdfMeasure(doc, fontOf(doc)) }).model);

    const sides = rows.flatMap(r => [r.home.name, r.away.name]);

    expect(sides.find(n => n.join('') === 'SV Kirchanschöring')).toHaveLength(1);
    expect(sides.find(n => n.join(' ').startsWith('SG Grabenstätt/Chieming/'))).toEqual(['SG Grabenstätt/Chieming/', 'Übersee']);
  });

  it('@DR-031 Fall b mit Inter: Kopf und Spiele auf einer Seite, Ende ca. 15:40', async () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    await registerPdfFonts(doc);
    const { model } = modelOf(FALL_B, { measure: jspdfMeasure(doc, fontOf(doc)) });

    expect(model.pages).toHaveLength(1);
    expect(rowsOf(model)).toHaveLength(20);
  });
});
