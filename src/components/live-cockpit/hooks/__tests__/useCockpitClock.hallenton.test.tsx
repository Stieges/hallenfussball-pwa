/**
 * H3b-3 Regel 3 im Cockpit (`useCockpitClock`, einzige Stelle für Spieltöne): Auf dem Lautsprecher-Gerät schweigt der
 * Cockpit-Ton für seine Felder, aber nur bei **bereitem** Lautsprecher dieses Geräts; im Zweifel tönt das Cockpit.
 * Kombinations-Tabelle @HT-033 Zeilen 2, 9, 10, dazu @HT-009. Die Laufzeit (echter Takt, Spieler, Kanal) schreibt ihre Meldung
 * in denselben `localStorage`, den das Cockpit liest; Abschnittsende von selbst über die Rückmeldung von `useAutoSectionEnd`.
 */
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COCKPIT, ENDE_A2, T0, server, zweiterAbschnitt } from '../../../../core/hallenton/__tests__/hallentonFixtures';
import type { StandQuelle } from '../../../../core/hallenton';
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

/** Lautsprecher dieses Geräts (Laptop) für Feld 1 im selben Speicher wie das Cockpit. */
async function laptop(quelle: StandQuelle | ((jetzt: number) => StandQuelle), { aktivieren = true } = {}): Promise<Tab> {
  const tab = new Tab({ start: 0, uhr, geraet: new FalschesGeraet(speicher) });
  const feld = feldAus([{ ab: T0, log: zweiterAbschnitt() }], undefined, 'field-1', quelle);
  tab.ffs.staendeZu = (jetzt) => [feld(jetzt)];
  await tab.starte({ aktivieren });
  return tab;
}

describe('@HT-033 Regel 3 – Cockpit-Ton am Lautsprecher-Gerät', () => {
  it('@HT-033 Zeile 2: Laptop leitet und ist Lautsprecher → der Cockpit-Ton schweigt, ein Ton aus der Laufzeit (Vibration bleibt)', async () => {
    const tab = await laptop(COCKPIT);
    const { playSound, abpfiff } = cockpit();
    await tab.vor(ENDE_A2 - uhr.jetzt());
    abpfiff(); // das Cockpit pfeift sein Ende ab
    await tab.vor(3000);
    expect(playSound).not.toHaveBeenCalled();
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(tab.toene().map((t) => t.art)).toEqual(['abpfiff']);
  });

  it('@HT-033 Zeile 9: kein Lautsprecher → kein Hallenton, das Cockpit tönt', () => {
    const { playSound, abpfiff } = cockpit();
    abpfiff();
    expect(playSound).toHaveBeenCalledTimes(1);
  });

  it('@HT-033 Zeile 10: Wechsel Handy → Laptop im Spiel → der Cockpit-Ton schweigt ab dem Wechsel, genau ein Ton', async () => {
    const wechsel = ENDE_A2 - 10_000;
    const tab = await laptop((jetzt) => (jetzt < wechsel ? server(200) : COCKPIT));
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
    await laptop(COCKPIT, { aktivieren: false });
    const { playSound, abpfiff } = cockpit();
    abpfiff();
    expect(playSound).toHaveBeenCalledTimes(1);
  });

  it('Lautstärke 0 % am Lautsprecher (nicht bereit) → das Cockpit tönt', async () => {
    const tab = await laptop(COCKPIT);
    tab.spieler.setzeLautstaerke('abpfiff', 0);
    await tab.vor(1500);
    const { playSound, abpfiff } = cockpit();
    abpfiff();
    expect(playSound).toHaveBeenCalledTimes(1);
  });

  it('Meldung älter als 2 s (Tab abgestürzt) → das Cockpit tönt sofort wieder', async () => {
    const tab = await laptop(COCKPIT);
    await tab.vor(1000);
    const { playSound, abpfiff } = cockpit();
    tab.takt.workerAussetzen(); // keine Erneuerung mehr
    tab.uhr.stummschalten('haupt'); // auch die Wache steht (Absturz)
    uhr.vorruecken(2100);
    abpfiff();
    expect(playSound).toHaveBeenCalledTimes(1);
  });

  it('anderes Feld oder anderes Turnier → das Cockpit tönt', async () => {
    await laptop(COCKPIT);
    const f2 = cockpit({ feldId: 'field-2' });
    f2.abpfiff();
    expect(f2.playSound).toHaveBeenCalledTimes(1);
    const anderes = cockpit({ tid: 'hallencup-sued' });
    anderes.abpfiff();
    expect(anderes.playSound).toHaveBeenCalledTimes(1);
  });
});
