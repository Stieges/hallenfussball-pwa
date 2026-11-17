/**
 * Gemerkte Lautsprecher der geteilten Statusabfrage (`erzeugeGeteilteAbfragen`, @HT-041, @HT-060): die volle Antwort ersetzt den alten Stand,
 * eine leere Liste entfernt alte Namen, Turniere sind getrennt, `zuruecksetzen` leert alles. Mit einer Abfrage-Attrappe, ohne Zeit und Netz.
 */
import { describe, expect, it } from 'vitest';
import type { HallStatusVoll } from '../../../core/repositories/hallentonRpc';
import { erzeugeGeteilteAbfragen } from '../runtime/hallStatusGeteilt';
import { lautsprecherLage } from '../runtime/hallStatusAuswertung';
import type { HallStatusAbfrage, HallStatusSchnappschuss } from '../runtime/hallStatusAbfrage';

type Sprecher = HallStatusVoll['speakers'][number];

const sprecher = (feld: number, name: string): Sprecher => ({
  field: feld, deviceName: name, isThisDevice: false, state: 'ready', assignedAt: 1, outputHint: false, hintAt: null, lastSeen: 1, ageMs: 1000, test: null,
});

function voll(speakers: HallStatusVoll['speakers']): HallStatusSchnappschuss {
  const antwort: HallStatusVoll = {
    sicht: 'voll', serverNow: 1, closed: false, speakers, leads: [],
    settings: { halftimeSound: 'horn-1', halftimeCustomPath: null, endCustomPath: null, goalToneFields: [], goalAnthemPaths: [] },
  };
  return { stand: 'aktuell', antwort, felder: {} };
}

/** Attrappe: `setze` ersetzt den Schnappschuss und benachrichtigt die Zuhörer wie die echte Abfrage. */
function attrappe(): HallStatusAbfrage & { setze(s: HallStatusSchnappschuss): void } {
  let stand: HallStatusSchnappschuss = { stand: 'laedt', antwort: null, felder: {} };
  const zuhoerer = new Set<() => void>();
  return {
    start: () => undefined, stop: () => undefined, abfragen: () => undefined,
    getSnapshot: () => stand,
    subscribe: (fn) => { zuhoerer.add(fn); return () => { zuhoerer.delete(fn); }; },
    setze(s) { stand = s; for (const fn of [...zuhoerer]) { fn(); } },
  };
}

function aufbau() {
  const abfragen = new Map<string, ReturnType<typeof attrappe>>();
  const geteilt = erzeugeGeteilteAbfragen(
    (id) => { const a = attrappe(); abfragen.set(id, a); return a; },
    () => null,
    { spaeter: () => () => undefined },
  );
  return { geteilt, abfragen };
}

describe('Gemerkte Lautsprecher je Turnier', () => {
  it('vor jeder Antwort: leer, „Lautsprecher bekannt“ aus', () => {
    const { geteilt } = aufbau();
    geteilt.abonniere('t1', () => undefined);
    expect(geteilt.letzteSprecher('t1')).toEqual([]);
  });

  it('eine volle Antwort ersetzt den Stand der vorigen vollständig', () => {
    const { geteilt, abfragen } = aufbau();
    geteilt.abonniere('t1', () => undefined);
    abfragen.get('t1')?.setze(voll([sprecher(1, 'Rechner A'), sprecher(2, 'Handy B')]));
    expect(geteilt.letzteSprecher('t1').map((s) => s.deviceName)).toEqual(['Rechner A', 'Handy B']);
    abfragen.get('t1')?.setze(voll([sprecher(2, 'Handy C')]));
    expect(geteilt.letzteSprecher('t1').map((s) => s.deviceName)).toEqual(['Handy C']);
  });

  it('eine volle Antwort mit leerer Liste entfernt den alten Namen', () => {
    const { geteilt, abfragen } = aufbau();
    geteilt.abonniere('t1', () => undefined);
    abfragen.get('t1')?.setze(voll([sprecher(1, 'Rechner A')]));
    abfragen.get('t1')?.setze(voll([]));
    expect(geteilt.letzteSprecher('t1')).toEqual([]);
  });

  it('Gegenbeispiel: eine Antwort ohne volle Sicht oder ohne Antwort lässt den Stand stehen', () => {
    const { geteilt, abfragen } = aufbau();
    geteilt.abonniere('t1', () => undefined);
    abfragen.get('t1')?.setze(voll([sprecher(1, 'Rechner A')]));
    abfragen.get('t1')?.setze({ stand: 'unbekannt', antwort: null, felder: {} });
    expect(geteilt.letzteSprecher('t1').map((s) => s.deviceName)).toEqual(['Rechner A']);
  });

  it('Turniere sind getrennt', () => {
    const { geteilt, abfragen } = aufbau();
    geteilt.abonniere('t1', () => undefined);
    geteilt.abonniere('t2', () => undefined);
    abfragen.get('t1')?.setze(voll([sprecher(1, 'Rechner A')]));
    expect(geteilt.letzteSprecher('t2')).toEqual([]);
    abfragen.get('t2')?.setze(voll([sprecher(1, 'Rechner Z')]));
    expect(geteilt.letzteSprecher('t1').map((s) => s.deviceName)).toEqual(['Rechner A']);
  });

  it('@HT-060 zuruecksetzen leert Gerätenamen, „bekannt“ und laufende Abfragen', () => {
    const { geteilt, abfragen } = aufbau();
    geteilt.abonniere('t1', () => undefined);
    abfragen.get('t1')?.setze({ ...voll([sprecher(1, 'Rechner A')]), felder: { 1: lautsprecherLage({ state: 'ready', ageMs: 1000, outputHint: false }, 1) } });
    expect(geteilt.lautsprecherBekannt('t1')).toBe(true);
    geteilt.zuruecksetzen();
    expect(geteilt.letzteSprecher('t1')).toEqual([]);
    expect(geteilt.lautsprecherBekannt('t1')).toBe(false);
    expect(geteilt.schnappschuss('t1').stand).toBe('laedt');
  });
});
