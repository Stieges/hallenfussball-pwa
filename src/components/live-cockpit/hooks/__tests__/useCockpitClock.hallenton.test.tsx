/**
 * H3b-3 Regel 3 im Cockpit (`useCockpitClock`, einzige Stelle für Spieltöne): Auf dem Lautsprecher-Gerät schweigt der
 * Cockpit-Ton für seine Felder, aber nur bei **bereitem** Lautsprecher dieses Geräts, dessen letzte Antwort des Servers beim
 * Ton-Anlass höchstens 5 s alt ist (H3b-4, K3); im Zweifel tönt das Cockpit. Regel 2 seit 07.11.: Der Lautsprecher tönt nach
 * dem Stand am Server, auch wenn der Laptop das Feld leitet. Kombinations-Tabelle @HT-033 Zeilen 2, 9, 10, 11, dazu @HT-009. Die Laufzeit (echter Takt, Spieler, Kanal) schreibt ihre Meldung
 * in denselben `localStorage`, den das Cockpit liest; Abschnittsende von selbst über die Rückmeldung von `useAutoSectionEnd`.
 */
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ENDE_A2, T0, ev, server, zweiterAbschnitt } from '../../../../core/hallenton/__tests__/hallentonFixtures';
import { FalschesGeraet, FalscherSpeicher } from '../../../../test/hallenton/falschesGeraet';
import { ManuelleUhr } from '../../../../test/hallenton/manuelleUhr';
import { Tab, feldAus } from '../../../../features/hallenton/runtime/__tests__/laufzeitTestlage';
import type { SectionEnded } from '../useAutoSectionEnd';

const ende = vi.hoisted(() => ({ onEnded: null as ((e: SectionEnded) => void) | null }));
vi.mock('../useAutoSectionEnd', () => ({
  useAutoSectionEnd: (p: { onEnded: (e: SectionEnded) => void }) => { ende.onEnded = p.onEnded; },
}));
vi.mock('../../../../hooks/useEngineClockCommands', () => ({
  useEngineClockCommands: () => ({ startSection: vi.fn(), adjustClock: vi.fn(), reopen: vi.fn() }),
}));

import { useCockpitClock } from '../useCockpitClock';

const TID = 'hallencup-nord';
let speicher: FalscherSpeicher;
let uhr: ManuelleUhr;
const vibrate = vi.fn();

beforeEach(() => {
  speicher = new FalscherSpeicher();
  vi.mocked(localStorage.getItem).mockImplementation((k: string) => speicher.getItem(k));
  vi.mocked(localStorage.setItem).mockImplementation((k: string, w: string) => speicher.setItem(k, w));
  vi.mocked(localStorage.removeItem).mockImplementation((k: string) => speicher.removeItem(k));
  uhr = new ManuelleUhr(ENDE_A2 - 20_000);
  vi.spyOn(Date, 'now').mockImplementation(() => uhr.jetzt()); // Kanal und Cockpit lesen dieselbe Geräteuhr
  vibrate.mockReset();
  Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true, writable: true });
});
afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'vibrate');
});

function cockpit(o: { tid?: string; feldId?: string; soundEnabled?: boolean } = {}) {
  const playSound = vi.fn();
  renderHook(() => useCockpitClock({
    tournamentId: o.tid ?? TID,
    match: { id: 'spiel-11', homeTeam: { id: 'sv-sued', name: 'SV Süd' }, awayTeam: { id: 'fc-nord', name: 'FC Nord' }, fieldId: o.feldId ?? 'field-1' },
    readOnly: false,
    settings: { soundEnabled: o.soundEnabled ?? true, hapticEnabled: true },
    playSound,
    engineView: null,
    melde: vi.fn(),
  }));
  let n = 0;
  const abpfiff = (): void => {
    n += 1;
    ende.onEnded?.({ kind: 'match', eventId: `ende-${n}` });
  };
  return { playSound, abpfiff };
}

/** Lautsprecher dieses Geräts (Laptop) für Feld 1 im selben Speicher wie das Cockpit; `alter` = Alter der letzten Antwort. */
async function laptop(alter: number | ((jetzt: number) => number), { aktivieren = true, log = zweiterAbschnitt() } = {}): Promise<Tab> {
  const tab = new Tab({ start: 0, uhr, geraet: new FalschesGeraet(speicher) });
  const feld = feldAus([{ ab: T0, log }], undefined, 'field-1', alter);
  tab.ffs.staendeZu = (jetzt) => [feld(jetzt)];
  await tab.starte({ aktivieren });
  return tab;
}

describe('@HT-033 Regel 3 – Cockpit-Ton am Lautsprecher-Gerät', () => {
  it('@HT-033 Zeile 2: Laptop leitet mit Netz und ist Lautsprecher → Laptop, einmal, nach dem Stand am Server; Cockpit-Ton schweigt (Vibration bleibt)', async () => {
    const tab = await laptop(server(200));
    const { playSound, abpfiff } = cockpit();
    await tab.vor(ENDE_A2 - uhr.jetzt());
    abpfiff(); // das Cockpit pfeift sein Ende ab
    await tab.vor(3000);
    expect(playSound).not.toHaveBeenCalled();
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(tab.toene().map((t) => t.art)).toEqual(['abpfiff']);
    expect(Math.abs(tab.toene()[0].at - ENDE_A2)).toBeLessThanOrEqual(20); // zur Zeit des Stands am Server
  });

  it('@HT-033 Zeile 9: kein Lautsprecher → kein Hallenton, das Cockpit tönt', () => {
    const { playSound, abpfiff } = cockpit();
    abpfiff();
    expect(playSound).toHaveBeenCalledTimes(1);
  });

  it('@HT-033 Zeile 10: Wechsel Handy → Laptop im Spiel → der Cockpit-Ton schweigt ab dem Wechsel, genau ein Ton', async () => {
    const wechsel = ENDE_A2 - 10_000;
    const tab = await laptop(server(200)); // vor und nach dem Wechsel der Stand am Server
    await tab.vor(wechsel + 500 - uhr.jetzt());
    const { playSound, abpfiff } = cockpit(); // ab dem Wechsel leitet der Laptop: sein Cockpit pfeift ab
    await tab.vor(ENDE_A2 - uhr.jetzt());
    abpfiff();
    await tab.vor(3000);
    expect(playSound).not.toHaveBeenCalled();
    expect(tab.toene().map((t) => t.art)).toEqual(['abpfiff']);
  });

  it('@HT-009 Tom hat den Abpfiff-Ton auf seinem Handy aus → kein Ton am Handy; am Hallen-Lautsprecher einmal der Abpfiff-Ton', async () => {
    const tab = await laptop(server(200)); // Laptop tönt nach dem Server (Toms Handy leitet)
    await tab.vor(ENDE_A2 + 3000 - uhr.jetzt());
    expect(tab.toene().map((t) => t.art)).toEqual(['abpfiff']);
    speicher.removeItem('hallenton:felder'); // Toms Handy ist ein anderes Gerät ohne Lautsprecher
    const { playSound, abpfiff } = cockpit({ soundEnabled: false });
    abpfiff();
    expect(playSound).not.toHaveBeenCalled();
  });
});

describe('Regel 3 – Gegenbeispiele: im Zweifel tönt das Cockpit', () => {
  it('Lautsprecher nicht bereit (Ton nicht aktiviert) → das Cockpit tönt', async () => {
    await laptop(server(200), { aktivieren: false });
    const { playSound, abpfiff } = cockpit();
    abpfiff();
    expect(playSound).toHaveBeenCalledTimes(1);
  });

  it('Lautstärke 0 % am Lautsprecher (nicht bereit) → das Cockpit tönt', async () => {
    const tab = await laptop(server(200));
    tab.spieler.setzeLautstaerke('abpfiff', 0);
    await tab.vor(1500);
    const { playSound, abpfiff } = cockpit();
    abpfiff();
    expect(playSound).toHaveBeenCalledTimes(1);
  });

  it('Meldung älter als 2 s (Tab abgestürzt) → das Cockpit tönt sofort wieder', async () => {
    const tab = await laptop(server(200));
    await tab.vor(1000);
    const { playSound, abpfiff } = cockpit();
    tab.takt.workerAussetzen(); // keine Erneuerung mehr
    tab.uhr.stummschalten('haupt'); // auch die Wache steht (Absturz)
    uhr.vorruecken(2100);
    abpfiff();
    expect(playSound).toHaveBeenCalledTimes(1);
  });

  it('anderes Feld oder anderes Turnier → das Cockpit tönt', async () => {
    await laptop(server(200));
    const f2 = cockpit({ feldId: 'field-2' });
    f2.abpfiff();
    expect(f2.playSound).toHaveBeenCalledTimes(1);
    const anderes = cockpit({ tid: 'hallencup-sued' });
    anderes.abpfiff();
    expect(anderes.playSound).toHaveBeenCalledTimes(1);
  });
});

describe('@HT-033 Zeile 11 und Gegenbeispiele nach Regel 2 (H3b-4)', () => {
  it('@HT-033 Zeile 11: Laptop leitet ohne Netz → kein Hallenton nach unsicherem Stand, der Cockpit-Ton am Laptop tönt (Lautsprecher nicht bereit)', async () => {
    const verloren = ENDE_A2 - 30_000;
    const tab = await laptop((jetzt) => jetzt - Math.min(jetzt, verloren));
    const { playSound, abpfiff } = cockpit();
    await tab.vor(ENDE_A2 - uhr.jetzt());
    expect(tab.laufzeit.getSnapshot().zustandJeFeld['field-1']).toBe('keineVerbindung');
    abpfiff();
    await tab.vor(6000);
    expect(playSound).toHaveBeenCalledTimes(1);
    expect(tab.toene()).toEqual([]);
  });

  it('Gegenbeispiel: Pause am Laptop ohne Netz → kein Hallenton nach altem Stand; das Cockpit tönt zu seinem eigenen Ende', async () => {
    // Netz weg 20 s vor dem Ende, Pause 10 s vor dem Ende nur am Laptop: am Server läuft die Uhr weiter bis 00:00
    const verloren = ENDE_A2 - 20_000;
    const tab = await laptop((jetzt) => jetzt - Math.min(jetzt, verloren));
    const { playSound, abpfiff } = cockpit();
    await tab.vor(ENDE_A2 + 8000 - uhr.jetzt());
    expect(tab.toene()).toEqual([]);
    abpfiff(); // nach dem Weiterlaufen endet das Spiel im Cockpit des Laptops
    expect(playSound).toHaveBeenCalledTimes(1);
  });

  it('Gegenbeispiel: Pause am Laptop mit Netz → der Hallenton folgt dem Stand am Server, genau einmal, das Cockpit schweigt', async () => {
    const halt = ENDE_A2 - 10_000;
    const pause = [...zweiterAbschnitt(), ev('PAUSE', halt, 2, null)];
    const weiter = [...pause, ev('RESUME', halt + 4000, 2, null)];
    const tab = new Tab({ start: 0, uhr, geraet: new FalschesGeraet(speicher) });
    const stufen = [{ ab: T0, log: zweiterAbschnitt() }, { ab: halt, log: pause }, { ab: halt + 4000, log: weiter }];
    const feld = feldAus(stufen, undefined, 'field-1', server(200));
    tab.ffs.staendeZu = (jetzt) => [feld(jetzt)];
    await tab.starte();
    const { playSound, abpfiff } = cockpit();
    await tab.vor(ENDE_A2 + 4000 - uhr.jetzt());
    abpfiff();
    await tab.vor(3000);
    expect(playSound).not.toHaveBeenCalled();
    expect(tab.toene().map((t) => t.art)).toEqual(['abpfiff']);
    expect(Math.abs(tab.toene()[0].at - (ENDE_A2 + 4000))).toBeLessThanOrEqual(20);
  });
});

describe('K3 – kein Fenster, in dem Halle und Cockpit beide schweigen (Freigabe und Regel 3 mit derselben 5-s-Grenze)', () => {
  /**
   * Netz weg `vorEndeMs` vor dem Ende; das Cockpit pfeift `spaeterMs` nach dem Ende ab. `rasterMs` verschiebt den 250-ms-Takt
   * der Laufzeit gegen das Ende (das Cockpit pfeift dann zwischen zwei Takten ab). Gezählt: Halle und Cockpit.
   */
  async function ende(vorEndeMs: number, spaeterMs = 0, rasterMs = 0): Promise<{ halle: number; cockpit: number }> {
    uhr.vorruecken(rasterMs);
    const netzWeg = ENDE_A2 - vorEndeMs;
    const tab = await laptop((jetzt) => jetzt - Math.min(jetzt, netzWeg));
    const { playSound, abpfiff } = cockpit();
    await tab.vor(ENDE_A2 + spaeterMs - uhr.jetzt());
    abpfiff();
    await tab.vor(6000);
    return { halle: tab.toene().length, cockpit: playSound.mock.calls.length };
  }

  for (const rasterMs of [0, 100, 200]) {
    for (const alterMs of [4000, 4900, 4990, 5000, 5010, 5100, 6000]) {
      it(`@HT-011 Takt um ${rasterMs} ms versetzt, Antwort zum Ende ${alterMs} ms alt → genau ein Ton, von der Halle oder vom Cockpit, nie keiner`, async () => {
        const { halle, cockpit: imCockpit } = await ende(alterMs, 0, rasterMs);
        expect(halle + imCockpit).toBe(1);
        expect(halle).toBe(alterMs <= 5000 ? 1 : 0); // die Freigabe gilt bis einschließlich 5 s
      });
    }
  }

  for (const alterMs of [4800, 5000, 5200]) {
    it(`Gegenbeispiel: das Cockpit pfeift 200 ms nach dem Ende ab (Takt des Cockpits), Antwort ${alterMs} ms alt → nie keiner, je Quelle höchstens einer`, async () => {
      const { halle, cockpit: imCockpit } = await ende(alterMs, 200);
      expect(halle + imCockpit).toBeGreaterThanOrEqual(1);
      expect(halle).toBeLessThanOrEqual(1);
      expect(imCockpit).toBeLessThanOrEqual(1);
    });
  }
});
