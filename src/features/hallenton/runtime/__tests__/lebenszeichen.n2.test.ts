/**
 * H4-1 (N2 aus dem Review H3b-3): „still“ nach dreimal `kein_recht` ist nicht dauerhaft (@HT-012, @HT-041: der Grund bleibt
 * sichtbar, nichts geschieht still). Es endet mit `wiederAufnehmen()` – die Verdrahtung ruft es bei einer Neu-Anmeldung
 * (SIGNED_IN/TOKEN_REFRESHED) und über `erneutVersuchen()` aus dem Hook. Gegenbeispiel: das „still“ nach Turnierende bleibt.
 * Echte Laufzeit, Sperren, Kanal; Server-Doppel nach der Migration.
 */
import { describe, expect, it } from 'vitest';
import { T0 } from '../../../../core/hallenton/__tests__/hallentonFixtures';
import { FalscherHallServer } from '../../../../test/hallenton/falscherHallServer';
import { FalschesGeraet } from '../../../../test/hallenton/falschesGeraet';
import { ManuelleUhr } from '../../../../test/hallenton/manuelleUhr';
import { LzTab } from './lebenszeichenTestlage';

function lage() {
  const uhr = new ManuelleUhr(T0);
  const geraet = new FalschesGeraet();
  const server = new FalscherHallServer(() => uhr.jetzt(), (fn, ms) => { uhr.gruppe('netz').spaeter(fn, ms); });
  server.zuordnen(1, 'laptop');
  return { server, tab: () => new LzTab({ start: T0, uhr, geraet, server, name: 'A', felder: [1] }) };
}

async function bisStill(a: LzTab, server: FalscherHallServer): Promise<void> {
  await a.starte({ aktivieren: false });
  await a.vor(1000);
  server.fehler = 'kein_recht';
  await a.vor(16_000);
  expect(a.tab.laufzeit.getSnapshot().rolle).toBe('still');
}

describe('@HT-012 @HT-041 N2 – „still“ nach kein_recht endet', () => {
  it('der Grund „kein_recht“ bleibt sichtbar, solange das Gerät still ist; es kommen keine Lebenszeichen mehr', async () => {
    const { server, tab } = lage();
    const a = tab();
    await bisStill(a, server);
    expect(a.fehler.at(-1)).toBe('kein_recht');
    const vorher = server.aufrufe.length;
    await a.vor(30_000);
    expect(server.aufrufe.length).toBe(vorher);
    expect(a.fehler.at(-1)).toBe('kein_recht'); // nicht zurückgesetzt
  });

  it('nach der Neu-Anmeldung (wiederAufnehmen) läuft das Lebenszeichen wieder, der Grund verschwindet mit dem Erfolg', async () => {
    const { server, tab } = lage();
    const a = tab();
    await bisStill(a, server);
    server.fehler = null; // das Konto hat sich neu angemeldet, das Recht gilt wieder
    const vorher = server.lebenszeichen.length;
    expect(a.lz.wiederAufnehmen()).toBe(true);
    await a.vor(12_000);
    expect(a.tab.laufzeit.getSnapshot().rolle).toBe('wartet');
    expect(server.lebenszeichen.length - vorher).toBeGreaterThanOrEqual(2);
    expect(a.fehler.at(-1)).toBeNull();
  });

  it('„erneut versuchen“ gilt wie eine Neu-Anmeldung; scheitert es erneut, ist das Gerät nach dreimal wieder still – mit Grund', async () => {
    const { server, tab } = lage();
    const a = tab();
    await bisStill(a, server);
    expect(a.lz.wiederAufnehmen()).toBe(true); // Recht noch nicht zurück
    await a.vor(16_000);
    expect(a.tab.laufzeit.getSnapshot().rolle).toBe('still');
    expect(a.fehler.at(-1)).toBe('kein_recht');
    server.fehler = null;
    expect(a.lz.wiederAufnehmen()).toBe(true);
    await a.vor(6000);
    expect(a.fehler.at(-1)).toBeNull();
  });

  it('Gegenbeispiel: ist das Gerät nicht wegen kein_recht still (läuft noch, oder Turnierende), tut wiederAufnehmen nichts', async () => {
    const { server, tab } = lage();
    const a = tab();
    await a.starte({ aktivieren: false });
    await a.vor(6000);
    expect(a.lz.wiederAufnehmen()).toBe(false); // läuft
    server.turnierBeendet = true;
    await a.vor(6000);
    expect(a.tab.laufzeit.getSnapshot().rolle).toBe('still');
    const aufrufe = server.aufrufe.length;
    expect(a.lz.wiederAufnehmen()).toBe(false);
    await a.vor(30_000);
    expect(a.tab.laufzeit.getSnapshot().rolle).toBe('still'); // das Turnierende bleibt endgültig
    expect(server.aufrufe.length).toBe(aufrufe);
  });

  it('ein aktivierter Tab tönt nach dem Neustart wieder (der Ton bleibt aktiviert)', async () => {
    const { server, tab } = lage();
    const a = tab();
    await a.starte(); // aktiviert
    await a.vor(1000);
    server.fehler = 'kein_recht';
    await a.vor(16_000);
    expect(a.tab.laufzeit.getSnapshot().rolle).toBe('still');
    server.fehler = null;
    a.lz.wiederAufnehmen();
    await a.vor(2000);
    expect(a.tab.laufzeit.getSnapshot().rolle).toBe('toent');
    expect(a.tab.laufzeit.getSnapshot().geraeteZustand).toBe('ready');
  });
});
