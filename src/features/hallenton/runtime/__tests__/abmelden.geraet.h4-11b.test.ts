/**
 * H4-11b @HT-057, Seite des abgemeldeten Geräts („Meldet die Turnierleitung das Gerät ab, sagt der Rechner das“): Gegeben der Rechner der Turnierleitung ist Hallen-Lautsprecher
 * für Feld 1. Wenn Olli auf einem anderen Gerät den Lautsprecher für Feld 1 abmeldet, dann gibt der Rechner für Feld 1 keinen Ton mehr und meldet den Verlust als „abgemeldet“,
 * nie als „von einem anderen Gerät übernommen“. Echte Laufzeit, echtes Lebenszeichen, Server-Doppel (`FalscherHallServer.abmelden` wie `hall_speaker_unassign`); die Uhr ist von Hand.
 * Der Wortlaut mit „Verstanden“ und das Verschwinden in den anderen Fenstern stehen in `ui/__tests__/DiesesGeraet.abgemeldet.h4-11b.test.tsx`.
 */
import { describe, expect, it } from 'vitest';
import { ENDE_A2, T0, zweiterAbschnitt } from '../../../../core/hallenton/__tests__/hallentonFixtures';
import { FalscherHallServer } from '../../../../test/hallenton/falscherHallServer';
import { FalschesGeraet } from '../../../../test/hallenton/falschesGeraet';
import { ManuelleUhr } from '../../../../test/hallenton/manuelleUhr';
import { feldAus, type Tab } from './laufzeitTestlage';
import { LzTab, TID } from './lebenszeichenTestlage';

function imSpiel(tab: Tab): void {
  const f = feldAus([{ ab: T0, log: zweiterAbschnitt() }]);
  tab.ffs.staendeZu = (jetzt) => [f(jetzt)];
}

function lage() {
  const start = ENDE_A2 - 40_000;
  const uhr = new ManuelleUhr(start);
  const server = new FalscherHallServer(() => uhr.jetzt(), (fn, ms) => { uhr.gruppe('netz').spaeter(fn, ms); });
  server.zuordnen(1, 'laptop', 'Rechner der Turnierleitung');
  const laptop = new LzTab({ start, uhr, geraet: new FalschesGeraet(), server, name: 'L', deviceId: 'laptop' });
  imSpiel(laptop.tab);
  /** Olli auf einem anderen Gerät im Unterpunkt „Hallenton“: Lautsprecher für Feld 1 abmelden. */
  const olliMeldetAb = () => server.abmelden({ p_tournament_id: TID, p_fields: [1] });
  return { uhr, server, laptop, olliMeldetAb };
}

describe('@HT-057 Der Rechner gibt für Feld 1 keinen Ton mehr und sagt „abgemeldet“', () => {
  it('Olli meldet ab → beim nächsten Lebenszeichen (höchstens 5 s) meldet der Rechner den Verlust als „abgemeldet“ für Feld 1, die Rolle endet', async () => {
    const { laptop, olliMeldetAb, server } = lage();
    await laptop.starte();
    await laptop.vor(6000);
    expect(laptop.verloren).toEqual([]); // vorher ist alles beim Alten
    expect(await olliMeldetAb()).toEqual({ ok: true, status: 'unassigned', fields: [1] });
    expect(server.lautsprecher.has(1)).toBe(false);
    await laptop.vor(5500);
    expect(laptop.verloren).toEqual([[{ feld: 1, art: 'abgemeldet' }]]); // nicht „abgeloest“ = nicht „von einem anderen Gerät übernommen“
    expect(laptop.abgeloest).toEqual([[]]);
    expect(laptop.tab.laufzeit.getSnapshot().rolle).toBe('aus');
  });

  it('Und der Rechner gibt für Feld 1 keinen Ton mehr: das Spielende danach bleibt stumm', async () => {
    const { laptop, olliMeldetAb, uhr } = lage();
    await laptop.starte();
    await laptop.vor(6000);
    await olliMeldetAb();
    await laptop.vor(ENDE_A2 + 4000 - uhr.jetzt()); // über das Ende von Spiel 11 hinaus
    expect(laptop.tab.toene()).toEqual([]);
  });

  it('Gegenbeispiel: ohne Abmelden tönt dasselbe Spielende (der Test prüft wirklich das Abmelden)', async () => {
    const { laptop, uhr } = lage();
    await laptop.starte();
    await laptop.vor(ENDE_A2 + 4000 - uhr.jetzt());
    expect(laptop.tab.toene().map((t) => t.art)).toEqual(['abpfiff']);
    expect(laptop.verloren).toEqual([]);
  });

  it('Gegenbeispiel: Olli meldet Feld 2 ab, der Rechner hat nur Feld 1 → nichts ändert sich für ihn', async () => {
    const { laptop, server, uhr } = lage();
    server.zuordnen(2, 'anderes-geraet');
    await laptop.starte();
    await laptop.vor(6000);
    await server.abmelden({ p_tournament_id: TID, p_fields: [2] });
    await laptop.vor(ENDE_A2 + 4000 - uhr.jetzt());
    expect(laptop.verloren).toEqual([]);
    expect(laptop.tab.toene().map((t) => t.art)).toEqual(['abpfiff']);
  });
});

describe('@HT-057 Gerät ohne Netz, wenn es abgemeldet wird, und meldet sich später wieder', () => {
  it('ohne Netz merkt der Rechner nichts (kein „abgemeldet“ aus der Luft); sobald das Netz wieder da ist, kommt „abgemeldet“ mit dem nächsten Lebenszeichen', async () => {
    const { laptop, olliMeldetAb } = lage();
    await laptop.starte();
    await laptop.vor(6000);
    laptop.netz = false; // der Rechner hat gerade kein Netz …
    await olliMeldetAb(); // … und Olli meldet ihn ab
    await laptop.vor(20_000);
    expect(laptop.verloren).toEqual([]);
    laptop.netz = true; // das Netz kommt wieder
    await laptop.vor(5500);
    expect(laptop.verloren).toEqual([[{ feld: 1, art: 'abgemeldet' }]]);
    expect(laptop.tab.laufzeit.getSnapshot().rolle).toBe('aus');
  });
});

describe('@HT-057 + @HT-015 Wettlauf: Gerät B übernimmt das Feld, bevor der abgemeldete Rechner sich meldet', () => {
  it('der Rechner sieht „von einem anderen Gerät übernommen“ (Entscheidung des Product Owners 15.11.), nicht „abgemeldet“', async () => {
    const { laptop, olliMeldetAb, server } = lage();
    await laptop.starte();
    await laptop.vor(6000);
    await olliMeldetAb();
    server.zuordnen(1, 'tablet-halle', 'Tablet Halle'); // B übernimmt, bevor der Rechner sich wieder meldet
    await laptop.vor(5500);
    expect(laptop.verloren).toEqual([[{ feld: 1, art: 'abgeloest' }]]);
    expect(laptop.abgeloest).toEqual([[]]);
  });

  it('Gegenbeispiel: übernimmt B erst NACH dem Lebenszeichen des Rechners, bleibt es „abgemeldet“', async () => {
    const { laptop, olliMeldetAb, server } = lage();
    await laptop.starte();
    await laptop.vor(6000);
    await olliMeldetAb();
    await laptop.vor(5500);
    server.zuordnen(1, 'tablet-halle', 'Tablet Halle');
    await laptop.vor(6000);
    expect(laptop.verloren).toEqual([[{ feld: 1, art: 'abgemeldet' }]]);
  });
});
