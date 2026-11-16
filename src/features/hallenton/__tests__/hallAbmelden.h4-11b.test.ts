/**
 * H4-11b @HT-057 + @HT-016: `meldeLautsprecherAb` ruft `hall_speaker_unassign` nur mit Turnier und Feld (nie mit einer Geräte-Kennung) und liest den Stand danach sofort neu, damit die Karte gleich
 * „kein Hallen-Lautsprecher“ zeigt; bei einem Fehler wird nichts neu gelesen und der Grund kommt zurück. Dazu `abfragen()` der Statusabfrage: läuft gerade eine Abfrage, deren Antwort älter ist als die
 * Änderung, folgt gleich eine zweite (sonst zeigte die Karte bis zum nächsten Takt noch den alten Stand) – der Takt selbst löst dagegen nie eine zweite aus.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HallArgs, HallErgebnis, HallStatusAntwort } from '../../../core/repositories/hallentonRpc';
import { FalscherHallServer } from '../../../test/hallenton/falscherHallServer';
import { ManuelleUhr } from '../../../test/hallenton/manuelleUhr';
import { T0 } from '../../../core/hallenton/__tests__/hallentonFixtures';
import { erzeugeHallStatusAbfrage } from '../runtime/hallStatusAbfrage';
import { flush } from '../runtime/__tests__/feldStandTestlage';

const gespraech = vi.hoisted(() => ({ unassign: vi.fn(), neuLesen: vi.fn() }));
vi.mock('../../../core/repositories/hallentonRpc', async (original) => ({ ...(await original<typeof import('../../../core/repositories/hallentonRpc')>()), hallSpeakerUnassign: gespraech.unassign }));
vi.mock('../../../lib/supabase', () => ({ supabase: { marke: 'client' }, isSupabaseConfigured: true }));
vi.mock('../useHallStatus', () => ({ hallStatusNeuLesen: gespraech.neuLesen }));

import { meldeLautsprecherAb } from '../hallAbmelden';

beforeEach(() => { gespraech.unassign.mockReset(); gespraech.neuLesen.mockReset(); });

describe('meldeLautsprecherAb', () => {
  it('Erfolg: ruft den Server mit Turnier und genau diesem Feld, ohne Geräte-Kennung, und liest den Stand sofort neu', async () => {
    gespraech.unassign.mockResolvedValue({ ok: true, status: 'unassigned', fields: [1] });
    expect(await meldeLautsprecherAb('t-sued', 1)).toEqual({ ok: true, status: 'unassigned', fields: [1] });
    expect(gespraech.unassign).toHaveBeenCalledWith({ marke: 'client' }, { p_tournament_id: 't-sued', p_fields: [1] });
    expect(gespraech.neuLesen).toHaveBeenCalledWith('t-sued');
  });

  it.each(['kein_recht', 'turnier_beendet', 'ungueltig', 'netz', 'antwort_unbekannt'] as const)('Gegenbeispiel Fehler %s: der Grund kommt zurück, es wird nichts neu gelesen (der Zustand bleibt)', async (grund) => {
    gespraech.unassign.mockResolvedValue({ ok: false, grund });
    expect(await meldeLautsprecherAb('t-sued', 2)).toEqual({ ok: false, grund });
    expect(gespraech.neuLesen).not.toHaveBeenCalled();
  });
});

describe('Statusabfrage: ein ausdrücklicher Auftrag während einer laufenden Abfrage wird nachgeholt', () => {
  function lage() {
    const uhr = new ManuelleUhr(T0);
    const server = new FalscherHallServer(() => uhr.jetzt());
    server.zuordnen(1, 'laptop');
    const freigaben: Array<() => void> = [];
    let aufrufe = 0;
    const abfrage = erzeugeHallStatusAbfrage({
      turnierId: 't-sued', deviceId: 'olli', online: () => true, zeitgeber: uhr.gruppe('olli'),
      // die Antwort wird erst gebaut, wenn der Test sie freigibt: sie zeigt den Stand zum Zeitpunkt der FREIGABE (wie ein Server, der antwortet, nachdem er geändert wurde)
      rpc: (args: HallArgs<'hall_sound_status'>): Promise<HallErgebnis<HallStatusAntwort>> => {
        aufrufe += 1;
        const gelesen = server.status(args);
        return new Promise((fertig) => { freigaben.push(() => { void gelesen.then(fertig); }); });
      },
    });
    return { server, abfrage, freigaben, uhr, aufrufe: () => aufrufe };
  }

  it('Die erste Abfrage läuft (Stand mit Lautsprecher); der Lautsprecher wird abgemeldet und `abfragen()` gerufen → nach der ersten folgt gleich eine zweite, die „kein Lautsprecher“ zeigt', async () => {
    const { server, abfrage, freigaben, aufrufe } = lage();
    abfrage.start();
    expect(aufrufe()).toBe(1);
    // die laufende Abfrage hat den alten Stand schon gelesen
    const alterStand = server.status({ p_tournament_id: 't-sued', p_device_id: 'olli' });
    await server.abmelden({ p_tournament_id: 't-sued', p_fields: [1] });
    abfrage.abfragen(); // die Karte soll nicht auf den nächsten Takt warten
    expect(aufrufe()).toBe(1); // die laufende wird nicht doppelt angestoßen …
    freigaben[0]?.();
    await alterStand;
    await flush();
    expect(aufrufe()).toBe(2); // … aber gleich danach folgt die zweite
    freigaben[1]?.();
    await flush();
    expect(abfrage.getSnapshot().antwort?.speakers).toEqual([]);
  });

  it('Gegenbeispiel: ohne ausdrücklichen Auftrag (nur der Takt) folgt keine zweite Abfrage hinterher', async () => {
    const { abfrage, freigaben, aufrufe, uhr } = lage();
    abfrage.start();
    uhr.vorruecken(5000); // der Takt kommt, während die erste noch läuft: wird übersprungen
    await flush();
    expect(aufrufe()).toBe(1);
    freigaben[0]?.();
    await flush();
    expect(aufrufe()).toBe(1);
  });
});
