/**
 * H3b-4 Fixrunde 1 (Review `task-h3b4-review.md`): K-1 Antwortzeit abrunden, K-2 nach einem Aussetzer sofort melden, K-3 eine
 * Grenze für die Freigabe (`antwortNoetigAb`). Regel 3 und @HT-011: Halle und Cockpit schweigen nie beide; das Cockpit schweigt
 * nur, wenn die Halle tönt (`docs/anforderungen/2026-10-15_hallenton.md`).
 */
import { describe, expect, it } from 'vitest';
import { LEERES_GEDAECHTNIS, planeHallToene } from '../../../../core/hallenton';
import { CTX_11, ENDE_A2, T0, server, stand, stateAus, zweiterAbschnitt } from '../../../../core/hallenton/__tests__/hallentonFixtures';
import { hallTontFeldIds } from '../../cockpitTon';
import { meldeFelderAnTabs, tonFrei } from '../laufzeitZustand';
import { leseLautsprecherFelder, type LautsprecherFeldMeldung, type LautsprecherMeldung } from '../lautsprecherKanal';
import { Tab, feldAus } from './laufzeitTestlage';

const TID = 'hallencup-nord';

function falscherKanal(alterMs: number | null = null) {
  const gemeldet: Array<{ turnierId: string; felder: readonly LautsprecherFeldMeldung[] }> = [];
  return {
    gemeldet,
    kanal: { melden: (m: { turnierId: string; felder: readonly LautsprecherFeldMeldung[] } | null) => { if (m) { gemeldet.push(m); } }, eigenesAlter: () => alterMs },
  };
}

const alsMeldung = (felder: readonly LautsprecherFeldMeldung[]): LautsprecherMeldung => ({ turnierId: TID, felder, tabId: 't', at: 0 });

describe('K-1 – die gemeldete Antwortzeit wird abgerundet (nie jünger als die wahre)', () => {
  it('@HT-011 Serverzeit gebrochen, Antwort zum Ende 5000,3 ms alt → die Halle verweigert, das Cockpit tönt', () => {
    const antwortAt = ENDE_A2 - 5000.3;
    const { kanal, gemeldet } = falscherKanal();
    meldeFelderAnTabs(kanal, TID, [1], { 'field-1': 'ready' }, () => antwortAt, ENDE_A2 - 300, null);
    // die Halle: Antwort vor `at − 5 s` → nicht frei
    const plan = planeHallToene({ felder: [stand(stateAus(zweiterAbschnitt()), CTX_11, 0, T0, 'field-1')], serverNow: ENDE_A2 - 60_000 }, LEERES_GEDAECHTNIS);
    const halleFrei = tonFrei(plan.toene[0], [stand(stateAus(zweiterAbschnitt()), CTX_11, ENDE_A2 - 300 - antwortAt, T0, 'field-1')], ENDE_A2 - 300);
    expect(halleFrei).toBe(false);
    // das Cockpit pfeift genau zum Ende: es darf nicht schweigen
    expect(hallTontFeldIds(alsMeldung(gemeldet[0].felder), TID, ENDE_A2)).toEqual([]);
  });
});

describe('K-2 – nach einem Aussetzer wird die neue Antwortzeit sofort gemeldet', () => {
  it('Regel 3: gemeldete Antwort 4,8 s alt, eine neuere liegt vor → sofort geschrieben, auch innerhalb der Sekunde', () => {
    const jetzt = ENDE_A2 - 400;
    const alt = [{ feld: 1, bereit: true, antwortAt: jetzt - 4800 }];
    const { kanal, gemeldet } = falscherKanal(300); // eigene Meldung erst 300 ms alt
    meldeFelderAnTabs(kanal, TID, [1], { 'field-1': 'ready' }, () => jetzt - 100, jetzt, alt);
    expect(gemeldet).toHaveLength(1);
    expect(gemeldet[0].felder[0].antwortAt).toBe(jetzt - 100);
  });

  it('Gegenbeispiel: im Normalbetrieb (gemeldete Antwort 1 s alt) bleibt es bei der Erneuerung je Sekunde', () => {
    const jetzt = ENDE_A2 - 400;
    const alt = [{ feld: 1, bereit: true, antwortAt: jetzt - 1000 }];
    const { kanal, gemeldet } = falscherKanal(300);
    meldeFelderAnTabs(kanal, TID, [1], { 'field-1': 'ready' }, () => jetzt - 100, jetzt, alt);
    expect(gemeldet).toEqual([]);
  });

  for (let rasterMs = 0; rasterMs < 1000; rasterMs += 50) {
    it(`@HT-011 Takt um ${rasterMs} ms versetzt: 4,7 s ohne Antwort, frische Antwort 0,5 s vor dem Ende → die Halle tönt, das Cockpit schweigt (kein Doppelton)`, async () => {
      const tab = new Tab({ start: ENDE_A2 - 12_000 + rasterMs });
      const weg = ENDE_A2 - 5200;
      const zurueck = ENDE_A2 - 500;
      const alter = (jetzt: number): number => (jetzt >= zurueck ? server(0) : server(jetzt - Math.min(jetzt, weg)));
      const feld = feldAus([{ ab: T0, log: zweiterAbschnitt() }], CTX_11, 'field-1', alter);
      tab.ffs.staendeZu = (jetzt) => [feld(jetzt)];
      await tab.starte();
      await tab.vor(ENDE_A2 - tab.uhr.jetzt());
      const meldung = leseLautsprecherFelder(tab.geraet.speicher, tab.uhr.jetzt());
      expect(hallTontFeldIds(meldung, TID, ENDE_A2)).toEqual(['field-1']); // Cockpit schweigt
      await tab.vor(3000);
      expect(tab.toene()).toHaveLength(1); // die Halle tönt einmal
    });
  }
});

describe('K-3 – eine Grenze: die Freigabe stützt sich auf `antwortNoetigAb` des Plans', () => {
  it('@HT-011 die Freigabe folgt der Grenze, die der Planer in den Ton schreibt', () => {
    const plan = planeHallToene({ felder: [stand(stateAus(zweiterAbschnitt()), CTX_11, 0, T0, 'field-1')], serverNow: ENDE_A2 - 60_000 }, LEERES_GEDAECHTNIS);
    const ton = plan.toene[0];
    const um = ton.at - 300;
    const antwort = (antwortAt: number) => [stand(stateAus(zweiterAbschnitt()), CTX_11, um - antwortAt, T0, 'field-1')];
    expect(tonFrei(ton, antwort(ton.antwortNoetigAb), um)).toBe(true);
    expect(tonFrei(ton, antwort(ton.antwortNoetigAb - 1), um)).toBe(false);
    // verschiebt der Plan die Grenze, folgt die Freigabe ohne zweite Stelle
    const enger = { ...ton, antwortNoetigAb: ton.at - 2000 };
    expect(tonFrei(enger, antwort(ton.at - 3000), um)).toBe(false);
  });
});
