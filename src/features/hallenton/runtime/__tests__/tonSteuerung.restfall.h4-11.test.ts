/**
 * H4-11 Fixrunde 1, Restfall N1 (@HT-054 Zeile 6, „jedes Ende genau einmal“): Endet ein Ton, bevor der nächste Takt von `bestaetigen` kommt, während
 * `setSinkId` noch läuft (Spieler „unbestätigt“), zählt er als gespielt und wird nicht nachgeholt. Gegenbeispiel: stand der Kontext, erklang nichts –
 * der Ton zählt nicht und wird einmal nachgeholt. Der Spieler ist ein schmales Doppel (nur, was die Steuerung braucht).
 */
import { describe, expect, it } from 'vitest';
import type { GeplanterTon } from '../../../../core/hallenton';
import type { HallTonSpieler, SpielerZustand } from '../hallTonSpieler';
import type { TaktQuelle } from '../taktQuelle';
import { erzeugeTonSteuerung, tonKennung } from '../tonSteuerung';

const TON: GeplanterTon = { at: 10_000, art: 'abpfiff', schluessel: ['m11'], felder: ['field-1'], enden: [{ schluessel: 'm11', feldId: 'field-1', at: 10_000 }], antwortNoetigAb: 0 };

function lage(o: { zustand: SpielerZustand; kontext: 'running' | 'suspended' }) {
  const state = { geplant: new Set<string>(), beendet: new Set<string>(), abgebrochen: [] as string[], geplantAnzahl: 0, kontext: o.kontext, zustand: o.zustand };
  const spieler = {
    zustand: () => state.zustand,
    audioKontext: () => ({ state: state.kontext, currentTime: 0, outputLatency: 0 }),
    audioZeitFuerServerZeit: (ms: number, now: number) => (ms - now) / 1000,
    planen: (id: string) => { state.geplant.add(id); state.geplantAnzahl += 1; return true; },
    abbrechen: (id: string) => { state.geplant.delete(id); state.abgebrochen.push(id); },
    geplant: () => [...state.geplant],
    endeVerbrauchen: (id: string) => state.beendet.delete(id),
  } as unknown as HallTonSpieler;
  const takt = { wecken: () => true, abbrechen: () => undefined } as unknown as TaktQuelle;
  const steuerung = erzeugeTonSteuerung({ takt, spieler });
  steuerung.uebernehmen([TON], 9_000, () => true);
  expect(state.geplantAnzahl).toBe(1);
  return { state, steuerung };
}

describe('N1 Restfall: das Ende kam vor dem nächsten Takt, während setSinkId lief', () => {
  it('der Ton ist schon zu Ende geklungen (Kontext lief), der Spieler steht auf „unbestätigt“ → er zählt als gespielt, genau einmal, nichts wird abgebrochen', () => {
    const { state, steuerung } = lage({ zustand: 'output_unconfirmed', kontext: 'running' });
    state.geplant.delete(tonKennung(TON)); // `ended`: nicht mehr geplant
    state.beendet.add(tonKennung(TON));
    expect(steuerung.bestaetigen(12_000).map((g) => g.ton.art)).toEqual(['abpfiff']);
    expect(state.abgebrochen).toEqual([]);
    expect(steuerung.bestaetigen(12_250)).toEqual([]); // der Eintrag ist erledigt: nie ein zweites Mal gemeldet
  });

  it('Gegenbeispiel: der Kontext stand, der Ton ist nie erklungen (nicht zu Ende geklungen, nicht mehr geplant) → er zählt nicht', () => {
    const { state, steuerung } = lage({ zustand: 'output_unconfirmed', kontext: 'suspended' });
    state.geplant.delete(tonKennung(TON));
    expect(steuerung.bestaetigen(12_000)).toEqual([]);
    expect(state.abgebrochen).toEqual([tonKennung(TON)]); // wird regulär nachgeholt, solange das Ende nicht länger als 5 s her ist
  });

  it('Gegenbeispiel: ein abgebrochener Ton (Ausgang verloren: nicht mehr geplant, nicht zu Ende geklungen) zählt nicht', () => {
    const { state, steuerung } = lage({ zustand: 'output_lost', kontext: 'running' });
    state.geplant.delete(tonKennung(TON));
    expect(steuerung.bestaetigen(12_000)).toEqual([]);
  });
});
