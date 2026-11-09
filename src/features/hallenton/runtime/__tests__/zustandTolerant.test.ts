/**
 * H4-2: Ein Zustand, den dieser App-Stand nicht kennt (nach der nächsten Migration z. B. `output_lost`), macht die Antwort von
 * `hall_sound_status` und der Leitung nicht unlesbar. Der Zustand heißt dann `unbekannt`: nicht bereit, ohne Wortgrund (die Pille
 * wie @HT-039 auf anderen Geräten), und nicht „Status unbekannt“ (@HT-041, das bleibt dem Netzausfall der Verwaltung vorbehalten).
 * Die Antworten kommen als rohes JSON durch den echten Client `hallentonRpc.ts`, nicht aus dem Server-Doppel.
 */
import { describe, expect, it } from 'vitest';
import { hallFieldLeadHeartbeat, hallSoundStatus } from '../../../../core/repositories/hallentonRpc';
import { FalscherHallServer } from '../../../../test/hallenton/falscherHallServer';
import { ManuelleUhr } from '../../../../test/hallenton/manuelleUhr';
import { cockpitTonSchweigt } from '../../../../core/hallenton';
import { erzeugeHallStatusAbfrage } from '../hallStatusAbfrage';
import { cockpitHinweisAus, cockpitHinweisAusLeitung, lautsprecherLage } from '../hallStatusAuswertung';
import { erzeugeLeitungLebenszeichen } from '../leitungLebenszeichen';
import { flush } from './feldStandTestlage';

const TID = '22222222-2222-4222-8222-222222222222';
const T0 = 1_794_000_000_000;
const OHNE_GRUND = { art: 'nichtBereit', grund: 'unbekannt', pruefen: false };

type Antwort = { data: unknown; error: { message: string } | null };
/** Ein Client, dessen `rpc` rohes JSON liefert, wie es der Server schickt. */
function rohClient(data: unknown) {
  const antwort: Antwort = { data, error: null };
  return { rpc: () => Promise.resolve(antwort) } as never;
}

const sprecher = (feld: number, state: unknown) => ({ field: feld, state, ageMs: 2000, outputHint: false });
const SCHMAL = { serverNow: T0, speakers: [sprecher(1, 'output_lost'), sprecher(2, 'ready')] };
const VOLL = {
  serverNow: T0,
  closed: false,
  speakers: [1, 2].map((feld) => ({
    ...sprecher(feld, feld === 1 ? 'output_lost' : 'ready'),
    deviceName: `Rechner ${feld}`, isThisDevice: false, assignedAt: T0 - 60_000, hintAt: null, lastSeen: T0 - 2000, test: null,
  })),
  leads: [],
  settings: { halftimeSound: 'horn-1', halftimeCustomPath: null, endCustomPath: null, goalToneFields: [] },
};

function verwaltungMit(data: unknown) {
  const uhr = new ManuelleUhr(T0);
  const verwaltung = erzeugeHallStatusAbfrage({
    turnierId: TID,
    deviceId: 'olli',
    rpc: (args) => hallSoundStatus(rohClient(data), args),
    online: () => true,
    zeitgeber: uhr.gruppe('olli'),
  });
  return { uhr, verwaltung };
}

async function lies(data: unknown) {
  const h = verwaltungMit(data);
  h.verwaltung.start();
  await flush();
  return h.verwaltung.getSnapshot();
}

describe('@HT-039 @HT-041 unbekannter Zustand in der Antwort von hall_sound_status', () => {
  it('@HT-039 volle Sicht: Feld 1 „output_lost“, Feld 2 „ready“ → die Antwort gilt, Feld 2 bereit, Feld 1 nicht bereit ohne Grund', async () => {
    const stand = await lies(VOLL);
    expect(stand.stand).toBe('aktuell');
    expect(stand.antwort?.sicht).toBe('voll');
    expect(stand.felder[2]).toEqual({ art: 'bereit', pruefen: false });
    expect(stand.felder[1]).toEqual(OHNE_GRUND);
    expect(cockpitHinweisAus(stand.felder[1] ?? { art: 'keiner' })).toEqual({ art: 'aus', grund: 'unbekannt', zuletztServerMs: null });
  });

  it('@HT-041 Gegenbeispiel: ein unbekannter Zustand ist kein „Status unbekannt“ (der Stand bleibt „aktuell“)', async () => {
    for (const data of [VOLL, SCHMAL]) {
      const stand = await lies(data);
      expect(stand.stand).not.toBe('unbekannt');
      expect(stand.stand).toBe('aktuell');
    }
  });

  it('@HT-039 schmale Sicht (Helfer): dasselbe – Feld 2 bereit, Feld 1 nicht bereit ohne Grund', async () => {
    const stand = await lies(SCHMAL);
    expect(stand.stand).toBe('aktuell');
    expect(stand.antwort?.sicht).toBe('schmal');
    expect(stand.felder[2]).toEqual({ art: 'bereit', pruefen: false });
    expect(stand.felder[1]).toEqual(OHNE_GRUND);
  });

  it('bekannte Werte und „noch kein Lebenszeichen“ (null) bleiben wie bisher', async () => {
    const antwort = await hallSoundStatus(rohClient({ serverNow: T0, speakers: [sprecher(1, 'volume_zero'), { ...sprecher(2, null), ageMs: null }] }), { p_tournament_id: TID });
    expect(antwort.ok && antwort.speakers.map((s) => s.state)).toEqual(['volume_zero', null]);
  });

  it('Gegenbeispiel: ein wirklich kaputtes Feld (state: 5) lässt die Antwort weiter scheitern', async () => {
    for (const data of [{ ...SCHMAL, speakers: [sprecher(1, 5)] }, { ...VOLL, speakers: [{ ...VOLL.speakers[0], state: 5 }] }]) {
      expect(await hallSoundStatus(rohClient(data), { p_tournament_id: TID })).toEqual({ ok: false, grund: 'antwort_unbekannt' });
    }
  });

  it('Gegenbeispiel: nur der Zustand wird lockerer – ein anderes kaputtes Feld verwirft die Antwort weiter', async () => {
    const kaputt = { ...SCHMAL, speakers: [{ ...sprecher(1, 'output_lost'), ageMs: 'zwei' }] };
    expect(await hallSoundStatus(rohClient(kaputt), { p_tournament_id: TID })).toEqual({ ok: false, grund: 'antwort_unbekannt' });
  });

  it('Test-Doppel: der Server meldet einen beliebigen Zustand, die App liest ihn als „unbekannt“', async () => {
    const uhr = new ManuelleUhr(T0);
    const server = new FalscherHallServer(() => uhr.jetzt());
    server.zuordnen(1, 'laptop');
    server.zuordnen(2, 'laptop');
    server.zustandSetzen(1, 'output_unconfirmed');
    server.zustandSetzen(2, 'ready');
    const antwort = await server.status({ p_tournament_id: TID, p_device_id: 'olli' });
    expect(antwort.ok && antwort.speakers.map((s) => s.state)).toEqual(['unbekannt', 'ready']);
  });
});

describe('@HT-039 @HT-041 unbekannter Zustand in der Antwort der Leitung (hall_field_lead_heartbeat)', () => {
  function leitungMit(speaker: unknown) {
    const uhr = new ManuelleUhr(T0);
    const leitung = erzeugeLeitungLebenszeichen({
      deviceId: 'handy',
      eigeneFelder: () => ({ [TID]: [1] }),
      angepfiffen: () => true,
      rpc: (args) => hallFieldLeadHeartbeat(rohClient({ status: 'ok', serverNow: T0, speaker }), args),
      zeitgeber: uhr.gruppe('handy'),
    });
    return leitung;
  }

  it('@HT-039 Feld 1 „output_lost“ → die Antwort gilt, im Cockpit „aus“ ohne Wortgrund, kein „Status unbekannt“', async () => {
    const leitung = leitungMit({ state: 'output_lost', ageMs: 2000, outputHint: false });
    leitung.start();
    await flush();
    const stand = leitung.stand(TID, 1);
    expect(stand?.speaker?.state).toBe('unbekannt');
    const hinweis = cockpitHinweisAusLeitung(stand, leitung.jetzt());
    expect(hinweis).toEqual({ art: 'aus', grund: 'unbekannt', zuletztServerMs: null });
    expect(hinweis.art).not.toBe('unbekannt');
    leitung.stop();
  });

  it('Gegenbeispiel: ein wirklich kaputter Zustand (state: 5) in der Leitungsantwort wird weiter verworfen', async () => {
    const antwort = await hallFieldLeadHeartbeat(
      rohClient({ status: 'ok', serverNow: T0, speaker: { state: 5, ageMs: 2000, outputHint: false } }),
      { p_tournament_id: TID, p_field: 1, p_device_id: 'handy' },
    );
    expect(antwort).toEqual({ ok: false, grund: 'antwort_unbekannt' });
  });
});

describe('Regel 3 – ein unbekannter Zustand gilt nicht als bereit', () => {
  it('Feld 1 mit „unbekannt“ → nicht bereit, der Cockpit-Ton schweigt dort nicht; Feld 2 „ready“ → er schweigt', async () => {
    const felder = (await lies(SCHMAL)).felder;
    const bereit = Object.entries(felder).filter(([, lage]) => lage.art === 'bereit').map(([feld]) => `field-${feld}`);
    expect(lautsprecherLage({ state: 'unbekannt', ageMs: 2000, outputHint: false }, T0).art).not.toBe('bereit');
    expect(cockpitTonSchweigt('field-1', bereit)).toBe(false);
    expect(cockpitTonSchweigt('field-2', bereit)).toBe(true);
  });
});
