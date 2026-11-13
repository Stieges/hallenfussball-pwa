/**
 * H3b-3 Datenseite für Verwaltung, Kopfzeile und Cockpit: Lebenszeichen der Leitung (@HT-034, @HT-035), Cockpit-Hinweise
 * (@HT-040, @HT-050), Stand des Lautsprechers in der Verwaltung (@HT-011, @HT-014, @HT-016, @HT-039, @HT-041, @HT-042, @HT-049).
 * Server-Doppel nach der Migration; die Zeit eines jeden Geräts ist eine eigene Zeitgruppe auf derselben Uhr.
 */
import { describe, expect, it } from 'vitest';
import { T0, anpfiff } from '../../../../core/hallenton/__tests__/hallentonFixtures';
import { FalscherHallServer } from '../../../../test/hallenton/falscherHallServer';
import { FalschesGeraet } from '../../../../test/hallenton/falschesGeraet';
import { ManuelleUhr } from '../../../../test/hallenton/manuelleUhr';
import { erzeugeHallStatusAbfrage } from '../hallStatusAbfrage';
import { cockpitHinweisAus, cockpitHinweisAusLeitung, leitungOhneNetz, lautsprecherLage } from '../hallStatusAuswertung';
import { erzeugeLeitungLebenszeichen } from '../leitungLebenszeichen';
import { flush } from './feldStandTestlage';
import { feldAus } from './laufzeitTestlage';
import { LzTab, TID } from './lebenszeichenTestlage';

const UM_1402 = T0 + 60_000;

function halle() {
  const uhr = new ManuelleUhr(T0);
  const server = new FalscherHallServer(() => uhr.jetzt());
  server.zuordnen(1, 'laptop');
  server.steuer.set(1, 'handy');
  const handy = { netz: true, angepfiffen: true, felder: { [TID]: [1] } as Record<string, number[]> };
  const leitung = erzeugeLeitungLebenszeichen({
    deviceId: 'handy',
    eigeneFelder: () => handy.felder,
    angepfiffen: () => handy.angepfiffen,
    rpc: (args) => (handy.netz ? server.leitungHeartbeat(args) : Promise.resolve({ ok: false, grund: 'netz' })),
    zeitgeber: uhr.gruppe('handy'),
  });
  const olli = { netz: true, online: true };
  const verwaltung = erzeugeHallStatusAbfrage({
    turnierId: TID,
    deviceId: 'olli',
    rpc: (args) => (olli.netz ? server.status(args) : Promise.resolve({ ok: false, grund: 'netz' })),
    online: () => olli.online,
    zeitgeber: uhr.gruppe('olli'),
  });
  const laptop = new LzTab({ start: T0, uhr, geraet: new FalschesGeraet(), server, name: 'L' });
  const feld = feldAus([{ ab: T0, log: anpfiff() }]);
  laptop.tab.ffs.staendeZu = (jetzt) => [feld(jetzt)];
  const vor = async (ms: number): Promise<void> => {
    const ziel = uhr.jetzt() + ms;
    while (uhr.jetzt() < ziel) {
      uhr.vorruecken(Math.min(100, ziel - uhr.jetzt()));
      await flush();
    }
  };
  const hinweis = () => cockpitHinweisAusLeitung(leitung.stand(TID, 1), leitung.jetzt());
  return { uhr, server, handy, leitung, olli, verwaltung, laptop, vor, hinweis };
}

/** Bis zur Bedingung, höchstens `grenzeMs`; liefert die verstrichene Zeit. */
async function bis(h: ReturnType<typeof halle>, bedingung: () => boolean, grenzeMs: number): Promise<number> {
  const start = h.uhr.jetzt();
  while (!bedingung() && h.uhr.jetzt() - start <= grenzeMs) {
    await h.vor(100);
  }
  return h.uhr.jetzt() - start;
}

describe('@HT-034 @HT-035 Lebenszeichen der Leitung – „Handy ohne Netz“', () => {
  it('@HT-035 Toms Handy leitet und hat kein Netz mehr → nach höchstens 15 s „Feld 1: Handy ohne Netz“; mit Netz nach höchstens 15 s wieder weg', async () => {
    const h = halle();
    h.leitung.start();
    h.verwaltung.start();
    await h.vor(12_000);
    const ohneNetz = (): boolean => {
      const a = h.verwaltung.getSnapshot().antwort;
      const lead = a?.sicht === 'voll' ? a.leads.find((l) => l.field === 1) : undefined;
      return leitungOhneNetz(lead?.ageMs ?? null, true);
    };
    expect(ohneNetz()).toBe(false);
    h.handy.netz = false;
    expect(await bis(h, ohneNetz, 15_000)).toBeLessThanOrEqual(15_000);
    h.handy.netz = true;
    expect(await bis(h, () => !ohneNetz(), 15_000)).toBeLessThanOrEqual(15_000);
  });

  it('@HT-034 alle 5 s, nur solange ein Spiel angepfiffen ist; ist es beendet, kein Lebenszeichen und kein Hinweis', async () => {
    const h = halle();
    h.leitung.start();
    await h.vor(20_500);
    expect(h.server.aufrufe.filter((f) => f === 'hall_field_lead_heartbeat')).toHaveLength(5);
    h.handy.angepfiffen = false;
    await h.vor(5000);
    const nachEnde = h.server.aufrufe.length;
    await h.vor(30_000);
    expect(h.server.aufrufe.length).toBe(nachEnde);
    expect(leitungOhneNetz(40_000, false)).toBe(false);
    expect(h.leitung.stand(TID, 1)).toBeNull();
    expect(h.hinweis()).toEqual({ art: 'keiner' });
  });

  it('Gegenbeispiel: ein Feld, das dieses Gerät nicht steuert, bekommt kein Lebenszeichen', async () => {
    const h = halle();
    h.handy.felder = {};
    h.leitung.start();
    await h.vor(20_000);
    expect(h.server.aufrufe).toEqual([]);
  });
});

describe('@HT-040 @HT-050 Cockpit-Hinweise zum Hallen-Lautsprecher (Datenseite)', () => {
  it('@HT-040 der Rechner meldet sich um 14:02 nicht mehr → nach höchstens 15 s „aus“ mit „meldet sich nicht (zuletzt 14:02)“; wieder da → nach höchstens 15 s weg', async () => {
    const h = halle();
    await h.laptop.starte();
    h.leitung.start();
    await h.vor(UM_1402 - h.uhr.jetzt());
    expect(h.hinweis()).toEqual({ art: 'bereit' });
    h.laptop.netz = false;
    const letztes = Math.max(...h.server.lebenszeichen.map((l) => l.at));
    const dauer = await bis(h, () => h.hinweis().art === 'aus', 15_000);
    expect(dauer).toBeLessThanOrEqual(15_000);
    expect(h.hinweis()).toEqual({ art: 'aus', grund: 'meldetSichNicht', zuletztServerMs: letztes });
    h.laptop.netz = true;
    expect(await bis(h, () => h.hinweis().art === 'bereit', 15_000)).toBeLessThanOrEqual(15_000);
  });

  it('@HT-050 ein starkes Anzeichen am Rechner, während Spiel 11 läuft oder pausiert → „Ausgang geändert“; „✓ Gehört“ → nach höchstens 15 s weg', async () => {
    const h = halle();
    await h.laptop.starte();
    h.leitung.start();
    await h.vor(6000);
    h.laptop.geraete.melden();
    expect(await bis(h, () => h.hinweis().art === 'ausgangGeaendert', 15_000)).toBeLessThanOrEqual(15_000);
    await h.server.gehoert({ p_tournament_id: TID, p_field: 1 });
    expect(await bis(h, () => h.hinweis().art === 'bereit', 15_000)).toBeLessThanOrEqual(15_000);
  });

  it('@HT-050 auf Feld 1 läuft kein Spiel → kein Hinweis im Cockpit (die Pille steht nur in der Verwaltung)', async () => {
    const h = halle();
    h.handy.angepfiffen = false;
    await h.laptop.starte();
    h.leitung.start();
    h.verwaltung.start();
    await h.vor(6000);
    h.laptop.geraete.melden();
    await h.vor(15_000);
    expect(h.hinweis()).toEqual({ art: 'keiner' });
    expect(h.verwaltung.getSnapshot().felder[1]).toEqual({ art: 'bereit', pruefen: true });
  });

  it('Gegenbeispiel: hat das leitende Gerät selbst kein Netz, ist der Stand nach 15 s „unbekannt“, nie ein alter Stand', async () => {
    const h = halle();
    await h.laptop.starte();
    h.leitung.start();
    await h.vor(6000);
    expect(h.hinweis()).toEqual({ art: 'bereit' });
    h.handy.netz = false;
    await h.vor(15_100);
    expect(h.hinweis()).toEqual({ art: 'unbekannt' });
  });

  it('@HT-039 Gründe: Kasten „aus“ mit Grund, aber kein Hinweis bei „eigener Ton nicht geladen“ (die Halle hört „Hupe 1“)', () => {
    const lage = (state: 'not_activated' | 'background' | 'slept' | 'custom_sound_failed' | 'volume_zero') => lautsprecherLage({ state, ageMs: 2000, outputHint: false }, T0);
    expect(cockpitHinweisAus(lage('not_activated'))).toEqual({ art: 'aus', grund: 'not_activated', zuletztServerMs: null });
    expect(cockpitHinweisAus(lage('background'))).toEqual({ art: 'aus', grund: 'background', zuletztServerMs: null });
    expect(cockpitHinweisAus(lage('slept'))).toEqual({ art: 'aus', grund: 'slept', zuletztServerMs: null });
    expect(cockpitHinweisAus(lage('volume_zero'))).toEqual({ art: 'aus', grund: 'volume_zero', zuletztServerMs: null });
    // Record 07.11. (@HT-028): „eigener Ton nicht geladen“ ist bereit mit ruhigem Hinweis – die Halle hört „Hupe 1“; vorher „nicht bereit“
    expect(lage('custom_sound_failed')).toEqual({ art: 'bereit', pruefen: false, eigenerTonFehlt: true });
    expect(cockpitHinweisAus(lage('custom_sound_failed'))).toEqual({ art: 'bereit' });
    expect(cockpitHinweisAus(lautsprecherLage({ state: 'ready', ageMs: 20_000, outputHint: false }, T0)))
      .toEqual({ art: 'aus', grund: 'meldetSichNicht', zuletztServerMs: T0 - 20_000 });
  });

  it('@HT-016 Feld ohne Hallen-Lautsprecher → neutral: kein Eintrag, kein Cockpit-Hinweis', () => {
    expect(lautsprecherLage(null, T0)).toEqual({ art: 'keiner' });
    expect(cockpitHinweisAus(lautsprecherLage(null, T0))).toEqual({ art: 'keiner' });
  });
});

describe('@HT-011 @HT-014 @HT-041 @HT-042 Stand in der Verwaltung (hall_sound_status)', () => {
  it('@HT-011 der Rechner verliert um 14:02 die Verbindung → andere Geräte sehen nach höchstens 15 s „meldet sich nicht (zuletzt 14:02)“', async () => {
    const h = halle();
    await h.laptop.starte();
    h.verwaltung.start();
    await h.vor(UM_1402 - h.uhr.jetzt());
    expect(h.verwaltung.getSnapshot().felder[1]).toEqual({ art: 'bereit', pruefen: false });
    h.laptop.netz = false;
    const letztes = Math.max(...h.server.lebenszeichen.map((l) => l.at));
    const dauer = await bis(h, () => h.verwaltung.getSnapshot().felder[1]?.art === 'meldetSichNicht', 15_000);
    expect(dauer).toBeLessThanOrEqual(15_000);
    expect(h.verwaltung.getSnapshot().felder[1]).toEqual({ art: 'meldetSichNicht', zuletztServerMs: letztes });
  });

  it('@HT-014 der Browser hält die App an (Takt > 3 s aus) → nach höchstens 15 s „nicht bereit – Hintergrund“', async () => {
    const h = halle();
    await h.laptop.starte();
    h.verwaltung.start();
    await h.vor(6000);
    h.laptop.tab.takt.workerAussetzen();
    const dauer = await bis(h, () => {
      const f = h.verwaltung.getSnapshot().felder[1];
      return f?.art === 'nichtBereit' && f.grund === 'background';
    }, 15_000);
    expect(dauer).toBeLessThanOrEqual(15_000);
  });

  it('@HT-041 Ollis Handy hat kein Netz → nach höchstens 15 s „Status unbekannt“ statt „bereit“; wieder Netz → nach höchstens 15 s der Stand vom Server', async () => {
    const h = halle();
    await h.laptop.starte();
    h.verwaltung.start();
    await h.vor(6000);
    expect(h.verwaltung.getSnapshot().stand).toBe('aktuell');
    h.olli.netz = false; // Anfragen scheitern, das Gerät glaubt noch an Netz
    expect(await bis(h, () => h.verwaltung.getSnapshot().stand === 'unbekannt', 15_000)).toBeLessThanOrEqual(15_000);
    expect(h.verwaltung.getSnapshot().felder).toEqual({});
    expect(h.verwaltung.getSnapshot().antwort).toBeNull();
    h.olli.netz = true;
    expect(await bis(h, () => h.verwaltung.getSnapshot().stand === 'aktuell', 15_000)).toBeLessThanOrEqual(15_000);
    expect(h.verwaltung.getSnapshot().felder[1]).toEqual({ art: 'bereit', pruefen: false });
  });

  it('@HT-041 der Browser meldet „offline“ → beim nächsten Lesen „unbekannt“, ohne Anfrage', async () => {
    const h = halle();
    h.verwaltung.start();
    await h.vor(6000);
    h.olli.online = false;
    const vorher = h.server.aufrufe.length;
    await h.vor(5000);
    expect(h.verwaltung.getSnapshot().stand).toBe('unbekannt');
    expect(h.server.aufrufe.length).toBe(vorher);
  });

  it('@HT-042 die Uhr von Ollis Handy geht 20 s vor oder nach → die Bereitschaft rechnet nur mit dem Alter vom Server', async () => {
    const h = halle();
    await h.laptop.starte();
    const echt = Date.now;
    try {
      Date.now = () => echt() + 20_000; // geht vor
      h.verwaltung.start();
      await h.vor(6000);
      expect(h.verwaltung.getSnapshot().felder[1]).toEqual({ art: 'bereit', pruefen: false });
      Date.now = () => echt() - 20_000; // geht nach
      h.laptop.netz = false;
      const letztes = Math.max(...h.server.lebenszeichen.map((l) => l.at));
      expect(await bis(h, () => h.verwaltung.getSnapshot().felder[1]?.art === 'meldetSichNicht', 15_000)).toBeLessThanOrEqual(15_000);
      expect(h.verwaltung.getSnapshot().felder[1]).toEqual({ art: 'meldetSichNicht', zuletztServerMs: letztes });
    } finally {
      Date.now = echt;
    }
  });

  it('schmale Sicht (nur writeMatchData) → Zustand je Feld ohne Gerätename und Testton', async () => {
    const h = halle();
    h.server.vollSicht = false;
    await h.laptop.starte();
    h.verwaltung.start();
    await h.vor(6000);
    expect(h.verwaltung.getSnapshot().antwort?.sicht).toBe('schmal');
    expect(h.verwaltung.getSnapshot().felder[1]).toEqual({ art: 'bereit', pruefen: false });
  });

  it('kein Recht → Stand „kein_recht“', async () => {
    const h = halle();
    h.server.fehler = 'kein_recht';
    h.verwaltung.start();
    await h.vor(1000);
    expect(h.verwaltung.getSnapshot().stand).toBe('kein_recht');
  });
});
