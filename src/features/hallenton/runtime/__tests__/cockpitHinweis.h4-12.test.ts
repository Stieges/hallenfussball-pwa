/**
 * H4-12 Cockpit-Hinweise, Datenseite: „Kein Netz – Halle zeigt alten Stand“ sofort nach dem ersten gescheiterten Versuch (@HT-034, @HT-035,
 * @HT-033 Zeile 11), Feld ohne Lautsprecher bleibt neutral – auch ohne Netz (@HT-016, @HT-038). Server-Doppel wie `leitungUndStatus.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { T0 } from '../../../../core/hallenton/__tests__/hallentonFixtures';
import { FalscherHallServer } from '../../../../test/hallenton/falscherHallServer';
import { ManuelleUhr } from '../../../../test/hallenton/manuelleUhr';
import { cockpitHinweisAusLeitung } from '../hallStatusAuswertung';
import { erzeugeLeitungLebenszeichen } from '../leitungLebenszeichen';
import { flush } from './feldStandTestlage';
import { TID } from './lebenszeichenTestlage';

function halle(mitLautsprecher: boolean) {
  const uhr = new ManuelleUhr(T0);
  const server = new FalscherHallServer(() => uhr.jetzt());
  if (mitLautsprecher) {
    server.zuordnen(1, 'laptop');
  }
  server.steuer.set(1, 'handy');
  const handy = { netz: true, haengt: false, grund: 'netz' as 'netz' | 'kein_recht' };
  const leitung = erzeugeLeitungLebenszeichen({
    deviceId: 'handy',
    eigeneFelder: () => ({ [TID]: [1] }),
    angepfiffen: () => true,
    rpc: (args) => (handy.netz ? server.leitungHeartbeat(args) : handy.haengt ? new Promise<never>(() => undefined) : Promise.resolve({ ok: false, grund: handy.grund })),
    zeitgeber: uhr.gruppe('handy'),
  });
  const vor = async (ms: number): Promise<void> => {
    const ziel = uhr.jetzt() + ms;
    while (uhr.jetzt() < ziel) {
      uhr.vorruecken(Math.min(100, ziel - uhr.jetzt()));
      await flush();
    }
  };
  const hinweis = () => cockpitHinweisAusLeitung(leitung.stand(TID, 1), leitung.jetzt(), leitung.versuchGescheitert(TID, 1));
  return { uhr, handy, leitung, vor, hinweis };
}

describe('@HT-034 @HT-035 „Kein Netz – Halle zeigt alten Stand“ im Cockpit (Datenseite)', () => {
  it('@HT-035 beim ersten gescheiterten Versuch ist „unbekannt“ (Kein Netz) sofort da, nicht erst nach 15 s', async () => {
    const h = halle(true);
    h.leitung.start();
    await h.vor(6000);
    expect(h.hinweis().art).not.toBe('unbekannt');
    h.handy.netz = false;
    await h.vor(5100); // genau ein Takt: der nächste Versuch scheitert
    expect(h.hinweis()).toEqual({ art: 'unbekannt' });
  });

  it('@HT-035 mit Netz verschwindet der Hinweis mit der nächsten Antwort, höchstens 15 s später', async () => {
    const h = halle(true);
    h.leitung.start();
    await h.vor(6000);
    h.handy.netz = false;
    await h.vor(5100);
    h.handy.netz = true;
    await h.vor(5100);
    expect(h.hinweis().art).not.toBe('unbekannt');
  });

  it('das Flag hält zwischen zwei Takten (kein Flackern)', async () => {
    const h = halle(true);
    h.leitung.start();
    await h.vor(6000);
    h.handy.netz = false;
    await h.vor(5100);
    expect(h.leitung.versuchGescheitert(TID, 1)).toBe(true);
    await h.vor(4000);
    expect(h.leitung.versuchGescheitert(TID, 1)).toBe(true); // jünger als 10 s, der nächste Versuch kommt erst
  });

  it('läuft ohne neuen Versuch nach 10 s ab: der nächste Versuch hängt, das Flag fällt nach 10 s, dann gilt die 15-s-Regel', async () => {
    const h = halle(true);
    h.leitung.start();
    await h.vor(6000);
    h.handy.netz = false;
    await h.vor(5100); // der erste Versuch scheitert (Flag gesetzt)
    h.handy.haengt = true; // der nächste Versuch hängt und sperrt weitere Versuche (`laufend`)
    await h.vor(4000);
    expect(h.leitung.versuchGescheitert(TID, 1)).toBe(true);
    await h.vor(6000); // jetzt 10,1 s nach dem gescheiterten Versuch
    expect(h.leitung.versuchGescheitert(TID, 1)).toBe(false);
    expect(h.hinweis()).toEqual({ art: 'unbekannt' }); // die letzte Antwort ist älter als 15 s: „Kein Netz“ ohne Lücke
  });

  it('beim Stoppen ist das Flag weg', async () => {
    const h = halle(true);
    h.leitung.start();
    await h.vor(6000);
    h.handy.netz = false;
    await h.vor(5100);
    h.leitung.stop();
    expect(h.leitung.versuchGescheitert(TID, 1)).toBe(false);
  });

  it('Gegenbeispiel: scheitert der Versuch nicht am Netz (kein Recht), erscheint kein „Kein Netz“', async () => {
    const h = halle(true);
    h.leitung.start();
    await h.vor(6000);
    h.handy.netz = false;
    h.handy.grund = 'kein_recht';
    await h.vor(5100);
    expect(h.leitung.versuchGescheitert(TID, 1)).toBe(false);
    expect(h.hinweis().art).not.toBe('unbekannt');
  });

  it('Gegenbeispiel @HT-038: ohne eingerichteten Lautsprecher bleibt das Cockpit neutral, auch ohne Netz und auch nach 15 s', async () => {
    const h = halle(false);
    h.leitung.start();
    await h.vor(6000);
    expect(h.hinweis()).toEqual({ art: 'keiner' });
    h.handy.netz = false;
    await h.vor(20_000);
    expect(h.hinweis()).toEqual({ art: 'keiner' });
  });

  it('Gegenbeispiel: ohne bekannten Stand (der erste Versuch scheitert schon) weiß das Cockpit nichts von einem Lautsprecher → keine Zeile', async () => {
    const h = halle(true);
    h.handy.netz = false;
    h.leitung.start();
    await h.vor(6000);
    expect(h.hinweis()).toEqual({ art: 'keiner' });
  });
});
