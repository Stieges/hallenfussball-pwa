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
  it('Restzeit mindestens 26 % der Höhe', () => { expect(cqh(displayHall.clock.font)).toBeGreaterThanOrEqual(26); });
  it('Namen: die größte Schrift erlaubt 20 % („Team 3“ gegen „Team 4“ mindestens 20 %)', () => { expect(cqh(displayHall.name.maxFont)).toBeGreaterThanOrEqual(20); });
  it('zwei Farbflächen füllen die oberen 69 % der Höhe', () => { expect(cqh(displayHall.panel.height)).toBe(69); });
  it('Zwei Zeilen Name passen ins Namensfeld (Feldhöhe mindestens zwei Zeilen der Schrift, die 12,5 % trägt)', () => {
    expect(cqh(displayHall.name.height)).toBeGreaterThanOrEqual(2 * 12.5 * displayHall.name.lineHeight);
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
});
