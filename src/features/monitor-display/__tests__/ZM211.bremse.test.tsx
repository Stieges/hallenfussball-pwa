/**
 * @ZM-211 @ZM-150 Fixrunde nach dem Review PR #559: Die schmale Aufteilung darf nie dazu führen, dass ein Name in mehr Zeilen umbricht als auf main
 * (R1: Zeichen außerhalb der Zeichentabelle, lange Bindestrich-Wörter) und nie Inhalt aus dem Bild schieben (R2: eigener Feldname in der schmalen
 * Spalte). Die Erwartungen stehen unabhängig vom Modell der Folie: Zeilen auf main aus `nameLines` (unverändertes Modell von main) bzw. aus einer
 * Zeilenrechnung mit eigener Zeichentabelle; die gerenderte Breite prüft `tests/e2e/listen-folien-umbruch.spec.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import { nextMatchesLayout, scheduleFieldLayout } from '../slideContent';
import { displayList } from '../../../design-tokens';
import { namenBreiteEm, nameZeilen } from '../listCompact';
import { nameCharsPerLine, nameLines } from '../listRows';
import { NextMatchesSlide } from '../slides/NextMatchesSlide';
import { listenTurnier } from './listFolienKit';
import { slide } from './monitorFixture';
import { withView } from './monitorViewHelper';

vi.unmock('i18next'); vi.unmock('react-i18next');
await (await import('../../../test/realDeI18n')).initRealDeI18n();

function fenster(breite: number, hoehe: number): void {
  Object.defineProperty(document.documentElement, 'clientWidth', { value: breite, configurable: true });
  Object.defineProperty(document.documentElement, 'clientHeight', { value: hoehe, configurable: true });
}
beforeEach(() => { fenster(1920, 1080); });
afterEach(() => { cleanup(); fenster(0, 0); });

/** Breiten in em (Inter, Normalschnitt) der Grundbuchstaben; Akzente ändern die Schrittweite nicht (eigene, kleine Tabelle für die Namen unten). */
const GRUND: Record<string, number> = {
  D: 0.722, f: 0.37, M: 0.903, l: 0.242, o: 0.6, d: 0.612, z: 0.552, i: 0.242, e: 0.583, w: 0.818, y: 0.562, K: 0.672, u: 0.591, b: 0.612, S: 0.642, p: 0.612, r: 0.376,
  t: 0.327, I: 0.269, s: 0.528, a: 0.562, n: 0.591, k: 0.549, ş: 0.528, ı: 0.242, G: 0.746, ç: 0.571, F: 0.59, h: 0.591, c: 0.571, ğ: 0.613,
  ł: 0.27, ż: 0.552, ' ': 0.281, '-': 0.46, '.': 0.288, V: 0.69, g: 0.613, P: 0.639, m: 0.876, 'İ': 0.269,
};
const wahr = (text: string): number => [...text].reduce((summe, z) => summe + (GRUND[z] ?? 0.6), 0);

/** Zeilen eines Namens bei Spaltenbreite `breiteEm`: Umbruch an Leerzeichen; Bindestrich-Wörter bleiben zusammen, solange sie in eine Zeile passen (so rendert die schmale Aufteilung). */
function wahreZeilen(name: string, breiteEm: number): number {
  let zeilen = 1; let belegt = 0;
  for (const wort of name.split(' ')) {
    const stuecke = wahr(wort) <= breiteEm || !wort.includes('-') ? [wort] : wort.split(/(?<=-)/);
    for (const [i, stueck] of stuecke.entries()) {
      const b = wahr(stueck) + (belegt > 0 && i === 0 ? GRUND[' '] : 0);
      if (belegt > 0 && belegt + b > breiteEm) { zeilen += 1; belegt = wahr(stueck); } else { belegt += b; }
    }
  }
  return zeilen;
}

function mitNamen(namen: readonly string[]): Tournament {
  const t = listenTurnier({ beendet: 5 });
  return { ...t, teams: t.teams.map((tm, i) => ({ ...tm, name: namen[i % namen.length] })) };
}
const RAENDER = [0, 2.5, 5, 10];

describe('@ZM-211 R1 Kein Name bricht durch die Vergrößerung in mehr Zeilen um als auf main', () => {
  const FEHLENDE = ['Młodzieżowy Klub Sportowy', 'İstanbul Başakşehir Gençlik', 'Fenerbahçe Işıkları Freilassing'];

  it.each(FEHLENDE)('Zeichen außerhalb der Zeichentabelle: „%s“ (Nächste Spiele und Spielplan, Rand 0 bis 10 Prozent)', (name) => {
    let geprueft = 0;
    for (const rand of RAENDER) {
      const { view } = withView(mitNamen([name, name, name, 'SV Süd', name, 'TSV Waging 1']));
      for (const layout of [...[1, 2, 3, 4].map(n => nextMatchesLayout(view, n, { overscan: rand, notice: false })), scheduleFieldLayout(view, 1, { overscan: rand, notice: false })]) {
        if (layout.frame.compact !== true) { continue; }
        geprueft += 1;
        const neu = wahreZeilen(name, namenBreiteEm(layout.frame, layout.columns, layout.frame.scale ?? 1));
        const bisher = wahreZeilen(name, namenBreiteEm(layout.frame, null, 1));
        expect(neu, `Rand ${String(rand)} %, Maßstab ${String(layout.frame.scale)}`).toBeLessThanOrEqual(bisher);
      }
    }
    expect(geprueft, 'mindestens eine Lage in der schmalen Aufteilung geprüft').toBeGreaterThan(0);
  });

  it.each([
    'SpVgg Garmisch-Partenkirchen II', 'Sportfreunde Hohenstein-Ernstthal', 'FC Königs Wusterhausen-Süd', 'Eintracht Oberweiler-Niederstetten 1919',
  ])('Bindestrich-Wörter: „%s“ bricht im Modell der Folie höchstens so oft um wie nach der Regel von main (`nameLines`) (Rand 0 bis 10 Prozent)', (name) => {
    let geprueft = 0;
    for (const rand of RAENDER) {
      const { view } = withView(mitNamen([name, name, name, 'SV Süd', name, 'TSV Waging 1']));
      const mainZeilen = nameLines(name, nameCharsPerLine({ overscan: rand, notice: false }));
      for (const layout of [...[1, 2, 3, 4].map(n => nextMatchesLayout(view, n, { overscan: rand, notice: false })), scheduleFieldLayout(view, 1, { overscan: rand, notice: false })]) {
        if (layout.frame.compact !== true) { continue; }
        geprueft += 1;
        const neu = nameZeilen(name, namenBreiteEm(layout.frame, layout.columns, layout.frame.scale ?? 1));
        expect(neu, `Rand ${String(rand)} %, Maßstab ${String(layout.frame.scale)}`).toBeLessThanOrEqual(mainZeilen);
      }
    }
    expect(geprueft, 'mindestens eine Lage in der schmalen Aufteilung geprüft').toBeGreaterThan(0);
  });

  it('Kontrolle: Namen ohne fehlende Zeichen und ohne Bindestrich wachsen weiter (nicht überall zurückgefallen)', () => {
    const { view } = withView(mitNamen(['SV Kirchanschöring', 'TSV Waging 2', 'SG Taching/Tengling']));
    expect(nextMatchesLayout(view, 4, { overscan: 5, notice: false }).frame.compact).toBe(true);
  });
});

describe('@ZM-211 R2 Ein eigener Feldname schiebt nichts aus dem Bild', () => {
  const felder = (name: string): Tournament => {
    const t = listenTurnier({ felder: 2, beendet: 5 });
    return { ...t, fields: (t.fields ?? []).map((f) => (f.id === 'field-2' ? { ...f, customName: name } : f)) };
  };
  const feldName = (t: Tournament) => (nr: number): string => (t.fields ?? [])[nr - 1]?.customName ?? (t.fields ?? [])[nr - 1]?.defaultName ?? `Feld ${String(nr)}`;
  const layout = (t: Tournament) => nextMatchesLayout(withView(t).view, 3, { overscan: 5, notice: false }, feldName(t));

  it('Kontrolle: mit „Feld 1“ / „Feld 2“ steht die schmale Aufteilung', () => {
    expect(layout(felder('Feld 2')).frame.compact).toBe(true);
  });

  it.each(['Dreifachhalle Nord', 'Dreifachhalle Nord Ost 12'])('Feldname „%s“ (18 und 25 Zeichen) passt nicht in die schmale Spalte: die Folie bleibt in der bisherigen Aufteilung', (name) => {
    expect(layout(felder(name)).frame.compact).not.toBe(true);
  });

  it('Feldname „Dreifachhalle“ (13 Zeichen): steht die Folie schmal, passt der Name (halbfett, Schrift des Zusatzes) mit Reserve in eine Zeile der Spalte', () => {
    const l = layout(felder('Dreifachhalle'));
    if (l.frame.compact === true) {
      // eigene Rechnung mit den Breiten der Grundbuchstaben und 10 % Zuschlag für halbfett; Zusatzschrift 3 vh in der Zeilenschrift 3,6 vh
      expect(wahr('Dreifachhalle') * 1.1 * (3 / 3.6)).toBeLessThanOrEqual(parseFloat(displayList.timeColumnWidth));
    }
  });

  it('Render: die Folie mit langem Feldnamen zeigt die bisherige Aufteilung (keine Zeile für „(war …)“, Zeitspalte wie bisher)', () => {
    const t = felder('Dreifachhalle Nord');
    render(<NextMatchesSlide slide={slide('next-matches', { matchCount: 3 })} {...withView(t)} theme="dark" style={{}} overscanPercent={5} />);
    expect(screen.queryAllByTestId('monitor-match-warline')).toHaveLength(0);
    expect(screen.getAllByTestId('monitor-match-field').some((e) => e.textContent === 'Dreifachhalle Nord')).toBe(true);
  });
});
