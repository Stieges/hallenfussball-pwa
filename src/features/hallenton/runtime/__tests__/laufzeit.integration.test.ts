/**
 * H3b-2b Integrationstest „Laufzeit“: echte Laufzeit, echter Feldstand gegen das Supabase-Doppel (Sammelabfrage im 1-s-Takt),
 * echter Takt-Adapter und Spieler. Die Abfragen liegen im 1-s-Raster mit Versatz 50, 300 und 950 ms gegen das Ende (wie
 * `laufImTakt`). Genau ein Ton zur richtigen Zeit für: Ende von selbst (@HT-004), Ende von Hand 0,5 s vor Ablauf (@HT-008),
 * Korrektur über die Grenze (@HT-051), zwei Felder gleichzeitig (@HT-032); dazu die unlesbare Zeile auf einem Feld.
 * Ein Eintrag am Handy ist nach 200 ms am Server.
 */
import { describe, expect, it } from 'vitest';
import type { EngineEvent, MatchContext } from '../../../../core/match';
import { phaseViewOf } from '../../../../core/match/client/phaseView';
import {
  ABSCHNITT_MS, CTX_11, CTX_12, ENDE_A2, T0, TAKT_VERSAETZE, ev, stateAus, zweiterAbschnitt,
} from '../../../../core/hallenton/__tests__/hallentonFixtures';
import { spielZeile } from './feldStandTestlage';
import { Tab } from './laufzeitTestlage';

const AM_SERVER_NACH_MS = 200;

async function lautsprecher(start: number, felder = [1]): Promise<Tab> {
  const tab = new Tab({ start, felder, feldStand: 'echt' });
  const lage = tab.lage;
  if (!lage) {
    throw new Error('Feldstand fehlt');
  }
  lage.sb.tabellen.matches = [
    spielZeile(CTX_11, 1, 11, '14:12:00', { match_status: 'running' }),
    spielZeile(CTX_12, felder.includes(2) ? 2 : 1, 12, '14:24:00', { match_status: felder.includes(2) ? 'running' : 'scheduled' }),
  ];
  lage.sende(CTX_11, zweiterAbschnitt());
  return tab;
}

function amServer(tab: Tab, ctx: MatchContext, e: EngineEvent): { um: number; tu: () => void } {
  return { um: e.at + AM_SERVER_NACH_MS, tu: () => tab.lage?.sende(ctx, [e]) };
}

describe('Integrationstest Laufzeit – 1-s-Raster mit Versatz', () => {
  for (const versatzMs of TAKT_VERSAETZE) {
    it(`@HT-004 Versatz ${versatzMs} ms: Ende von selbst → genau ein Abpfiff-Ton, höchstens 1 s neben Toms Cockpit`, async () => {
      const tab = await lautsprecher(ENDE_A2 - 20_000 + versatzMs);
      const cockpitEnde = phaseViewOf(stateAus(zweiterAbschnitt()), CTX_11, ENDE_A2 - 20_000).limitAt;
      await tab.starte();
      await tab.vor(30_000);
      expect(cockpitEnde).toBe(ENDE_A2);
      expect(tab.toene().map((t) => t.art)).toEqual(['abpfiff']);
      expect(Math.abs(tab.toene()[0].at - ENDE_A2)).toBeLessThanOrEqual(1000);
    });

    it(`@HT-008 Versatz ${versatzMs} ms: Abpfiff von Hand 0,5 s vor Ablauf → genau ein Abpfiff-Ton`, async () => {
      const vonHand = ENDE_A2 - 500;
      const tab = await lautsprecher(ENDE_A2 - 20_000 + versatzMs);
      await tab.starte();
      await tab.vor(30_000, [amServer(tab, CTX_11, ev('MATCH_END', vonHand, 2, 2 * ABSCHNITT_MS - 500))]);
      expect(tab.toene().map((t) => t.art)).toEqual(['abpfiff']);
      expect(tab.toene()[0].at - vonHand).toBeGreaterThanOrEqual(0);
      expect(tab.toene()[0].at - vonHand).toBeLessThanOrEqual(1000 + AM_SERVER_NACH_MS);
    });

    it(`@HT-051 Versatz ${versatzMs} ms: Korrektur 5:40 → 6:20 über die Grenze → einmal, sobald sie ankommt; kein zweiter Ton`, async () => {
      const korrigiertAt = ENDE_A2 - 20_000;
      const tab = await lautsprecher(korrigiertAt - 10_000 + versatzMs);
      await tab.starte();
      await tab.vor(40_000, [amServer(tab, CTX_11, ev('CLOCK_ADJUST', korrigiertAt, 2, 2 * ABSCHNITT_MS + 20_000))]);
      const ankunft = korrigiertAt + AM_SERVER_NACH_MS;
      expect(tab.toene().map((t) => t.art)).toEqual(['abpfiff']);
      expect(tab.toene()[0].at - ankunft).toBeGreaterThanOrEqual(0);
      expect(tab.toene()[0].at - ankunft).toBeLessThanOrEqual(1300);
    });

    it(`@HT-032 Versatz ${versatzMs} ms: zwei Felder enden 0,5 s nacheinander → ein Abpfiff-Ton`, async () => {
      const tab = await lautsprecher(ENDE_A2 - 20_000 + versatzMs, [1, 2]);
      tab.lage?.sende(CTX_12, zweiterAbschnitt(T0 + 500));
      await tab.starte();
      await tab.vor(30_000);
      expect(tab.toene().map((t) => t.art)).toEqual(['abpfiff']);
      expect(Math.abs(tab.toene()[0].at - ENDE_A2)).toBeLessThanOrEqual(1000);
    });
  }

  it('@HT-011 Feld 2 mit unlesbarer Zeile → kein Ton für Feld 2, Feld 1 tönt; Feld 2 zeigt „keine Verbindung“', async () => {
    const tab = await lautsprecher(ENDE_A2 - 20_000, [1, 2]);
    tab.lage?.sende(CTX_12, zweiterAbschnitt(T0 + 10_000));
    await tab.starte();
    const zeile = ev('RESUME', ENDE_A2 - 10_000, 2, null);
    await tab.vor(30_000, [{ um: ENDE_A2 - 12_000, tu: () => tab.lage?.sende(CTX_12, [{ ...zeile, type: 'ZEITSTRAFE_KUENFTIG' as EngineEvent['type'] }]) }]);
    expect(tab.toene()).toHaveLength(1);
    expect(Math.abs(tab.toene()[0].at - ENDE_A2)).toBeLessThanOrEqual(1000);
    expect(tab.laufzeit.getSnapshot().zustandJeFeld).toEqual({ 'field-1': 'ready', 'field-2': 'keineVerbindung' });
  });

  it('@HT-033 Zeile 4 mit echtem Feldstand: Laptop verliert 30 s vor dem Ende die Verbindung → kein Ton, „keine Verbindung“', async () => {
    const tab = await lautsprecher(ENDE_A2 - 40_000);
    await tab.starte();
    await tab.vor(45_000, [{ um: ENDE_A2 - 30_000, tu: () => { if (tab.lage) { tab.lage.sb.netz = 'fehler'; } } }]);
    expect(tab.toene()).toEqual([]);
    expect(tab.laufzeit.getSnapshot().zustandJeFeld['field-1']).toBe('keineVerbindung');
  });
});
