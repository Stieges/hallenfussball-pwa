/**
 * H3c Integrationstest „Laufzeit“ mit Toren und Ende (@HT-024): echte Laufzeit, echter Feldstand gegen das Supabase-Doppel
 * (Sammelabfrage im 1-s-Takt bei angepfiffenem Spiel), echter Takt-Adapter und Spieler. Die Abfragen liegen im 1-s-Raster mit
 * Versatz 50, 300 und 950 ms (wie `laufzeit.integration.test.ts`). Ein Eintrag am Handy ist nach 200 ms am Server.
 * Gherkin: Feld 1 mit „Ton bei Tor“, „Hymne A“/„Hymne B“/„Hymne C“; Tom trägt zwei Tore ein, das zweite 4 s vor Schluss.
 */
import { describe, expect, it } from 'vitest';
import type { EngineEvent, MatchContext } from '../../../../core/match';
import { CTX_11, CTX_12, ENDE_A2, TAKT_VERSAETZE, ev, zweiterAbschnitt } from '../../../../core/hallenton/__tests__/hallentonFixtures';
import { spielZeile } from './feldStandTestlage';
import { HYMNE, Tab } from './laufzeitTestlage';

const AM_SERVER_NACH_MS = 200;
/** Spätestens so lange nach dem Tor beginnt die Hymne: am Server, nächste Abfrage (1 s), nächster Takt (250 ms). */
const HOECHSTENS_NACH_MS = AM_SERVER_NACH_MS + 1000 + 250 + 50;

async function lautsprecher(start: number): Promise<Tab> {
  const tab = new Tab({ start, felder: [1], feldStand: 'echt', torWahl: { felder: [1], hymnen: [HYMNE.a, HYMNE.b, HYMNE.c] } });
  const lage = tab.lage;
  if (!lage) {
    throw new Error('Feldstand fehlt');
  }
  lage.sb.tabellen.matches = [
    spielZeile(CTX_11, 1, 11, '14:12:00', { match_status: 'running' }),
    spielZeile(CTX_12, 1, 12, '14:24:00'),
  ];
  lage.sende(CTX_11, zweiterAbschnitt());
  return tab;
}

function amServer(tab: Tab, ctx: MatchContext, e: EngineEvent): { um: number; tu: () => void } {
  return { um: e.at + AM_SERVER_NACH_MS, tu: () => tab.lage?.sende(ctx, [e]) };
}

describe('Integrationstest Laufzeit mit Torhymne – 1-s-Raster mit Versatz', () => {
  for (const versatzMs of TAKT_VERSAETZE) {
    it(`@HT-024 Versatz ${versatzMs} ms: zwei Tore → „Hymne A“, dann „Hymne B“; die zweite bricht beim Ablauf ab, der Abpfiff-Ton genau einmal`, async () => {
      const tor1 = ev('GOAL', ENDE_A2 - 20_000, 2, null, { teamId: CTX_11.teamAId });
      const tor2 = ev('GOAL', ENDE_A2 - 4000, 2, null, { teamId: CTX_11.teamBId });
      const tab = await lautsprecher(ENDE_A2 - 30_000 + versatzMs);
      await tab.starte();
      await tab.vor(40_000, [amServer(tab, CTX_11, tor1), amServer(tab, CTX_11, tor2)]);
      const h = tab.hymnen();
      expect(h.map((x) => x.hymne)).toEqual(['a', 'b']);
      expect(h[0].at - tor1.at).toBeGreaterThan(AM_SERVER_NACH_MS);
      expect(h[0].at - tor1.at).toBeLessThanOrEqual(HOECHSTENS_NACH_MS);
      expect(h[0].bis - h[0].at).toBe(8000);
      expect(h[1].at - tor2.at).toBeLessThanOrEqual(HOECHSTENS_NACH_MS);
      const toene = tab.toene();
      expect(toene.map((t) => t.art)).toEqual(['abpfiff']);
      expect(Math.abs(toene[0].at - ENDE_A2)).toBeLessThanOrEqual(1000);
      expect(h[1].bis).toBe(toene[0].at); // die Hymne endet genau mit dem Beginn des Abpfiff-Tons
    });

    it(`@HT-024 Versatz ${versatzMs} ms: Rücknahme während der Hymne → Abbruch, sobald die Rücknahme am Server ist; kein weiterer Ton`, async () => {
      const tor1 = ev('GOAL', ENDE_A2 - 25_000, 2, null, { teamId: CTX_11.teamAId });
      const zurueck = ev('RETRACT', tor1.at + 3000, 2, null, { actor: 'leitung', targetId: tor1.id });
      const tab = await lautsprecher(ENDE_A2 - 30_000 + versatzMs);
      await tab.starte();
      await tab.vor(20_000, [amServer(tab, CTX_11, tor1), amServer(tab, CTX_11, zurueck)]);
      const h = tab.hymnen();
      expect(h).toHaveLength(1);
      expect(h[0].bis - zurueck.at).toBeGreaterThan(AM_SERVER_NACH_MS);
      expect(h[0].bis - zurueck.at).toBeLessThanOrEqual(HOECHSTENS_NACH_MS);
      expect(tab.toene()).toEqual([]);
    });
  }
});
