/**
 * @ZM-213 Mindestgrößen der Live-Folie „Farbseiten“ als Anteil der Höhe der Folienfläche (Einheit `cqh`): die Werte des Tokens-Satzes
 * tragen die Mindestwerte des Gherkins. Die gemessenen Größen je Fall (Namen) stehen im Bericht zur Aufnahme der echten App.
 */
import { describe, it, expect } from 'vitest';
import { displayHall } from '../displayHall';

const cqh = (wert: string): number => {
  expect(wert).toMatch(/^[\d.]+cqh$/);
  return parseFloat(wert);
};

describe('@ZM-213 displayHall', () => {
  it('Torzahlen mindestens 34 % der Höhe', () => { expect(cqh(displayHall.digit.font)).toBeGreaterThanOrEqual(34); });
  it('Restzeit mindestens 26 % der Höhe, nach @ZM-215 so groß wie möglich (über 29,3 %)', () => { expect(cqh(displayHall.clock.font)).toBeGreaterThan(29.3); });
  it('Zeitbalken mindestens 6 % der Höhe (@ZM-215, Profil „Halle (sehr fern)“)', () => { expect(cqh(displayHall.bar.height)).toBeGreaterThanOrEqual(6); });
  it('Namen: die größte Schrift erlaubt 20 % („Team 3“ gegen „Team 4“ mindestens 20 %)', () => { expect(cqh(displayHall.name.maxFont)).toBeGreaterThanOrEqual(20); });
  it('zwei Farbflächen füllen die oberen 64,5 % der Höhe (geändert mit @ZM-215: der Platz geht an Restzeit und Zeitbalken)', () => { expect(cqh(displayHall.panel.height)).toBe(64.5); });
  it('Zwei Zeilen Name passen ins Namensfeld (Feldhöhe mindestens zwei Zeilen der Schrift, die 12,5 % trägt)', () => {
    expect(cqh(displayHall.name.height)).toBeGreaterThanOrEqual(2 * 12.5 * displayHall.name.lineHeight);
  });
  it('@ZM-213 Zwei Zeilen zu 15 % passen ins Namensfeld („TSV Fridolfing / DJK Otting“ mindestens 15 %, die Höhe begrenzt dort die Schrift)', () => {
    expect(cqh(displayHall.name.height)).toBeGreaterThanOrEqual(2 * 15 * displayHall.name.lineHeight);
  });
  it('Namensfeld, Torzahl und Balken überlappen sich nicht: Torzahl (Versalhöhe) beginnt unter dem Namensfeld, der Balken unter der Fläche', () => {
    const namenEnde = cqh(displayHall.name.top) + cqh(displayHall.name.height);
    const zahlOben = cqh(displayHall.panel.height) - cqh(displayHall.digit.bottom) - cqh(displayHall.digit.font) * displayHall.digit.lineHeight;
    expect(zahlOben).toBeGreaterThanOrEqual(namenEnde);
  });
  it('Das Uhrband hat Platz für die Restzeit samt Balken (Höhe der Folie: Fläche + Balken + Band)', () => {
    const band = 100 - cqh(displayHall.panel.height) - cqh(displayHall.bar.gapTop) - cqh(displayHall.bar.height) - cqh(displayHall.band.padBottom);
    expect(band).toBeGreaterThanOrEqual(cqh(displayHall.clock.font) * displayHall.clock.lineHeight);
  });
  it('Nah-Angaben (Feld, Gruppe, Abzeichen) mindestens 7,08 % (12 Bogenminuten aus 10 m)', () => { expect(cqh(displayHall.side.font)).toBeGreaterThanOrEqual(7.08); });
  // Umgestellt: bisher 5,6 % der Höhe der Folie (Review PR #563 B1: der Test war an den Code angepasst). Der Gherkin von @ZM-213 sagt „bis auf 5,5 % der Bildschirmhöhe“
  it('Seitenschrift: Nah-Grenze 7,08 % der BILDSCHIRMhöhe; die Notlösung geht bis 5,5 % der Bildschirmhöhe (@ZM-213, Review PR #563 B1)', () => {
    expect(displayHall.side.fontMin).toBe('7.08vh');
    expect(displayHall.side.fontNot).toBe('5.5vh');
  });
  it('Symbole neben der Restzeit (@ZM-215, Daniel 2026-11-19): alle Maße in em der Seitenspalte, damit sie mit der Schrift kleiner werden; kein Symbol höher als zwei Zeilen', () => {
    for (const [name, wert] of Object.entries(displayHall.symbols)) { expect(wert, name).toMatch(/^[\d.]+em$/); }
    expect(parseFloat(displayHall.symbols.state)).toBeGreaterThanOrEqual(1);
    expect(parseFloat(displayHall.symbols.state)).toBeLessThanOrEqual(2);
  });
});
