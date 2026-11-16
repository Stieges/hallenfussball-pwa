/**
 * H4-18 @HT-059: die Anzeige für den Kopf des Cockpits – eine Störung entfällt nur, wenn der Kasten für dieses Feld gezeigt wird (reine Funktion).
 */
import { describe, expect, it } from 'vitest';
import type { FeldAnzeige, FeldAnzeigeArt, HallAnzeige } from '../hallAnzeige';
import { hallAnzeigeOhneGezeigtenKasten } from '../hallAnzeigeCockpit';

const feld = (nr: number, art: FeldAnzeigeArt['art'], eigenesGeraet = false): FeldAnzeige => ({ feld: nr, anzeige: { art } as FeldAnzeigeArt, eigenesGeraet });
const anzeige = (...felder: FeldAnzeige[]): HallAnzeige => ({ felder, handyOhneNetz: [], statusUnbekannt: false });
const nummern = (a: HallAnzeige): number[] => a.felder.map((f) => f.feld);

describe('hallAnzeigeOhneGezeigtenKasten (@HT-059)', () => {
  it('ohne gezeigten Kasten bleibt die Anzeige dieselbe (gleiches Objekt)', () => {
    const a = anzeige(feld(1, 'nichtBereit'));
    expect(hallAnzeigeOhneGezeigtenKasten(a, new Set())).toBe(a);
  });
  it('„nicht bereit“ und „keine Verbindung“ des Felds mit Kasten entfallen, die eines anderen Felds bleiben', () => {
    const a = anzeige(feld(1, 'nichtBereit'), feld(2, 'nichtBereit'), feld(3, 'keineVerbindung', true));
    expect(nummern(hallAnzeigeOhneGezeigtenKasten(a, new Set([1])))).toEqual([2, 3]);
    expect(nummern(hallAnzeigeOhneGezeigtenKasten(a, new Set([3])))).toEqual([1, 2]);
  });
  it('„Ton nicht aktiv“ und „schlafen gelegt“ entfallen nur, wenn das Gerät Lautsprecher genau der Felder mit Kasten ist', () => {
    expect(nummern(hallAnzeigeOhneGezeigtenKasten(anzeige(feld(1, 'tonNichtAktiv', true)), new Set([1])))).toEqual([]);
    expect(nummern(hallAnzeigeOhneGezeigtenKasten(anzeige(feld(1, 'schlafenGelegt', true)), new Set([1])))).toEqual([]);
    const beide = anzeige(feld(1, 'tonNichtAktiv', true), feld(2, 'tonNichtAktiv', true));
    expect(nummern(hallAnzeigeOhneGezeigtenKasten(beide, new Set([1])))).toEqual([1, 2]);
    const anderes = anzeige(feld(2, 'tonNichtAktiv', true));
    expect(nummern(hallAnzeigeOhneGezeigtenKasten(anderes, new Set([1])))).toEqual([2]);
  });
  it('bereit und der Hinweis „anderes Fenster“ bleiben unberührt (sie filtert der Kopf nach Rang)', () => {
    const a = anzeige(feld(1, 'bereit'), feld(2, 'anderesFenster', true));
    expect(nummern(hallAnzeigeOhneGezeigtenKasten(a, new Set([1, 2])))).toEqual([1, 2]);
  });
});
