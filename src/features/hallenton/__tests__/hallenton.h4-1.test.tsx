/**
 * H4-1 Anschluss (Laufzeit, keine Oberfläche): Spur der Ablösung (@HT-015), Fehlergrund des Lebenszeichens für alle Tabs des
 * Geräts (@HT-012, @HT-041), „still“ nach kein_recht endet (N2: Neu-Anmeldung, „erneut versuchen“) und Anhören als eigene Art am
 * Hook (H3c-Befund 4). Ein zweiter Tab ist hier ein `storage`-Ereignis auf demselben `localStorage` – so sieht ihn der Browser.
 * Echter Baustein, echte Verdrahtung (`browserLaufzeit.ts`), Supabase-Doppel; Takt-Worker gefälscht.
 */
import { act, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../../auth/context/authContextInstance';
import type { AuthContextValue } from '../../auth/context/authContextValue';
import { FalscherAudioKontext, tonDaten } from '../../../test/hallenton/falscherAudioKontext';
import { FalscherSupabase } from '../../../test/hallenton/falscherSupabase';
import { FalscherSpeicher } from '../../../test/hallenton/falschesGeraet';
import { erzeugeHallTonSpieler } from '../runtime/hallTonSpieler';
import {
  ABGELOEST_SCHLUESSEL, FEHLER_SCHLUESSEL, GERAET_SCHLUESSEL, __setzeGeraetFuerTests, abgeloestVerstanden, erneutVersuchen, geraetStand,
} from '../lautsprecherGeraet';

const sb = vi.hoisted((): { client: unknown } => ({ client: null }));
const engineKontext = vi.hoisted(() => ({
  accountId: 'konto-olli',
  clock: { serverNow: () => Date.now(), sync: () => Promise.resolve(true) },
  engine: { view: () => null, subscribe: () => () => undefined },
}));
vi.mock('../../../lib/supabase', () => ({
  get supabase() { return sb.client; },
  isSupabaseConfigured: true,
}));
vi.mock('../../../hooks/useWakeLock', () => ({ useWakeLock: () => ({ status: 'idle', request: vi.fn(), release: vi.fn() }) }));
vi.mock('../../../core/contexts/RepositoryContext', () => ({ useRepositories: () => ({ tournamentRepository: { get: () => Promise.resolve(null) } }) }));
vi.mock('../lokalesTurnier', () => ({ ladeTurnierLokal: () => Promise.resolve(null) }));
vi.mock('../../match-engine/useMatchEngineContext', () => ({ useMatchEngineContextOptional: () => engineKontext }));

import { HallLautsprecherLaufzeit } from '../HallLautsprecherLaufzeit';
import { useHallLautsprecher } from '../useHallLautsprecher';

const TID = '22222222-2222-4222-8222-222222222222';
const ANDERES = '33333333-3333-4333-8333-333333333333';
let speicher: FalscherSpeicher;
let kontext: FalscherAudioKontext;
let falsch: FalscherSupabase;

class FalscherWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postMessage(): void { /* kein Takt: es geht um Lebenszeichen und Marken */ }
  terminate(): void { /* nichts */ }
}

const einschalten = (felder = [1]): void => {
  speicher.setItem(GERAET_SCHLUESSEL, JSON.stringify({ turnierId: TID, felder, name: 'Rechner der Turnierleitung' }));
};
const heartbeat = (felder: Array<{ field: number; status: 'ok' | 'superseded' | 'unassigned' }>): void => {
  falsch.rpcDaten.hall_speaker_heartbeat = { status: 'ok', serverNow: 1, fields: felder.map((f) => ({ ...f, test: null, lead: null })) };
};
const heartbeats = (): number => falsch.rpcLog.filter((r) => r.fn === 'hall_speaker_heartbeat').length;
/** Ein anderer Tab hat in den `localStorage` geschrieben: der Browser meldet das als `storage`-Ereignis. */
const andererTab = (schluessel: string, wert: string | null): void => {
  if (wert === null) {
    speicher.removeItem(schluessel);
  } else {
    speicher.setItem(schluessel, wert);
  }
  act(() => { window.dispatchEvent(new StorageEvent('storage', { key: schluessel, newValue: wert })); });
};
const warten = async (): Promise<void> => {
  for (let i = 0; i < 8; i += 1) {
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  }
};
const vor = async (ms: number): Promise<void> => {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });
  speicher = new FalscherSpeicher();
  vi.mocked(localStorage.getItem).mockImplementation((k: string) => speicher.getItem(k));
  vi.mocked(localStorage.setItem).mockImplementation((k: string, w: string) => speicher.setItem(k, w));
  vi.mocked(localStorage.removeItem).mockImplementation((k: string) => speicher.removeItem(k));
  falsch = new FalscherSupabase();
  sb.client = falsch.client;
  kontext = new FalscherAudioKontext();
  __setzeGeraetFuerTests({
    spieler: erzeugeHallTonSpieler({ erzeugeKontext: () => kontext, ladeDaten: () => Promise.resolve(tonDaten(2)), speicher: localStorage }),
  });
  vi.stubGlobal('Worker', FalscherWorker);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  __setzeGeraetFuerTests();
});

describe('@HT-015 Ablösung hinterlässt eine Spur, statt still zu löschen', () => {
  it('der Server meldet Feld 1 als abgelöst (superseded) → Marke mit Turnier, Feld und Serverzeit, Rolle weg, alle Tabs sehen die Marke', async () => {
    einschalten();
    heartbeat([{ field: 1, status: 'superseded' }]);
    const { result } = renderHook(() => useHallLautsprecher(TID));
    const vorher = Date.now();
    render(<HallLautsprecherLaufzeit />);
    await warten();
    expect(result.current.rolle).toBe('keiner'); // die Rolle ist weg
    expect(speicher.getItem(GERAET_SCHLUESSEL)).toBeNull();
    const marke: unknown = JSON.parse(speicher.getItem(ABGELOEST_SCHLUESSEL) ?? 'null');
    expect(marke).toEqual({ turnierId: TID, felder: [1], um: expect.any(Number) });
    expect((marke as { um: number }).um).toBeGreaterThanOrEqual(vorher);
    expect(result.current.abgeloest).toEqual({ felder: [1], um: (marke as { um: number }).um });
  });

  it('ein zweiter Tab sieht die Marke über das storage-Ereignis, auch ohne eigene Laufzeit', () => {
    const { result } = renderHook(() => useHallLautsprecher(TID));
    expect(result.current.abgeloest).toBeNull();
    andererTab(ABGELOEST_SCHLUESSEL, JSON.stringify({ turnierId: TID, felder: [1, 2], um: 1_790_000_000_000 }));
    expect(result.current.abgeloest).toEqual({ felder: [1, 2], um: 1_790_000_000_000 });
  });

  it('Gegenbeispiel: die Marke eines anderen Turniers erscheint nicht für dieses Turnier', () => {
    const { result } = renderHook(() => useHallLautsprecher(ANDERES));
    andererTab(ABGELOEST_SCHLUESSEL, JSON.stringify({ turnierId: TID, felder: [1], um: 5 }));
    expect(result.current.abgeloest).toBeNull();
  });

  it('Gegenbeispiel: nur Feld 2 wird abgelöst → Marke nur für Feld 2, Feld 1 bleibt Lautsprecher', async () => {
    einschalten([1, 2]);
    heartbeat([{ field: 1, status: 'ok' }, { field: 2, status: 'superseded' }]);
    const { result } = renderHook(() => useHallLautsprecher(TID));
    render(<HallLautsprecherLaufzeit />);
    await warten();
    expect(result.current.abgeloest?.felder).toEqual([2]);
    expect(result.current.felder).toEqual([1]);
    expect(result.current.rolle).toBe('diesesTurnier');
  });

  it('ein neues Einschalten auf diesem Gerät löscht die Marke, in allen Tabs', async () => {
    falsch.rpcDaten.hall_speaker_assign = { status: 'assigned', fields: [1], replaced: [] };
    speicher.setItem(ABGELOEST_SCHLUESSEL, JSON.stringify({ turnierId: TID, felder: [1], um: 5 }));
    const { result } = renderHook(() => useHallLautsprecher(TID));
    expect(result.current.abgeloest).toEqual({ felder: [1], um: 5 });
    await act(async () => { await result.current.einschalten([1], 'Rechner der Turnierleitung'); });
    expect(result.current.abgeloest).toBeNull();
    expect(speicher.getItem(ABGELOEST_SCHLUESSEL)).toBeNull();
  });

  it('abgeloestVerstanden() löscht die Marke; ein anderer Tab sieht es', () => {
    speicher.setItem(ABGELOEST_SCHLUESSEL, JSON.stringify({ turnierId: TID, felder: [1], um: 5 }));
    const { result } = renderHook(() => useHallLautsprecher(TID));
    expect(result.current.abgeloest).not.toBeNull();
    act(() => { result.current.abgeloestVerstanden(); });
    expect(result.current.abgeloest).toBeNull();
    expect(speicher.getItem(ABGELOEST_SCHLUESSEL)).toBeNull();
    andererTab(ABGELOEST_SCHLUESSEL, JSON.stringify({ turnierId: TID, felder: [1], um: 9 })); // ein anderer Tab löst erneut ab
    expect(result.current.abgeloest).toEqual({ felder: [1], um: 9 });
    act(() => { abgeloestVerstanden(); });
    expect(geraetStand().abgeloest).toBeNull();
  });
});

describe('@HT-012 @HT-041 Der Grund des Lebenszeichens gilt für alle Tabs des Geräts', () => {
  it('Fehler im meldenden Tab → der Grund steht im localStorage, ein zweiter Tab zeigt denselben Grund; ein Erfolg setzt ihn zurück', async () => {
    einschalten();
    falsch.rpcFehler.hall_speaker_heartbeat = '22023'; // ungültig (z. B. Feldzahl verkleinert)
    const { result } = renderHook(() => useHallLautsprecher(TID));
    render(<HallLautsprecherLaufzeit />);
    await warten();
    expect(result.current.lebenszeichenFehler).toBe('ungueltig');
    expect(speicher.getItem(FEHLER_SCHLUESSEL)).toBe('ungueltig');
    // ein zweiter Tab (neuer Hook-Aufruf liest denselben Speicher) sieht denselben Grund
    const zweiter = renderHook(() => useHallLautsprecher(TID));
    expect(zweiter.result.current.lebenszeichenFehler).toBe('ungueltig');
    delete falsch.rpcFehler.hall_speaker_heartbeat;
    heartbeat([{ field: 1, status: 'ok' }]);
    await vor(5100);
    expect(result.current.lebenszeichenFehler).toBeNull();
    expect(speicher.getItem(FEHLER_SCHLUESSEL)).toBeNull();
  });

  it('der Grund eines anderen Tabs kommt über das storage-Ereignis an, auch ohne eigene Laufzeit', () => {
    einschalten();
    const { result } = renderHook(() => useHallLautsprecher(TID));
    expect(result.current.lebenszeichenFehler).toBeNull();
    andererTab(FEHLER_SCHLUESSEL, 'kein_recht');
    expect(result.current.lebenszeichenFehler).toBe('kein_recht');
    andererTab(FEHLER_SCHLUESSEL, null);
    expect(result.current.lebenszeichenFehler).toBeNull();
  });

  it('Gegenbeispiel: ein unbekannter Wert im Speicher gilt als kein Grund', () => {
    einschalten();
    speicher.setItem(FEHLER_SCHLUESSEL, 'gibt-es-nicht');
    const { result } = renderHook(() => useHallLautsprecher(TID));
    expect(result.current.lebenszeichenFehler).toBeNull();
  });
});

describe('@HT-012 N2 – „still“ nach dreimal kein_recht endet (Verdrahtung)', () => {
  const stillGeworden = async () => {
    einschalten();
    falsch.rpcFehler.hall_speaker_heartbeat = '42501';
    const kopf = renderHook(() => useHallLautsprecher(TID));
    const baustein = render(<HallLautsprecherLaufzeit />);
    await warten();
    await vor(11_000); // Lebenszeichen bei 0, 5, 10 s
    return { ...kopf, baustein };
  };

  it('dreimal kein_recht → still, der Grund „kein_recht“ bleibt für alle Tabs sichtbar; „erneut versuchen“ meldet wieder', async () => {
    const { result } = await stillGeworden();
    expect(result.current.laufzeit?.rolle).toBe('still');
    expect(result.current.lebenszeichenFehler).toBe('kein_recht');
    const bisher = heartbeats();
    await vor(30_000);
    expect(heartbeats()).toBe(bisher); // still: keine Lebenszeichen
    expect(result.current.lebenszeichenFehler).toBe('kein_recht');
    delete falsch.rpcFehler.hall_speaker_heartbeat; // das Recht ist zurück
    heartbeat([{ field: 1, status: 'ok' }]);
    act(() => { result.current.erneutVersuchen(); });
    await warten();
    expect(heartbeats()).toBeGreaterThan(bisher);
    expect(result.current.laufzeit?.rolle).toBe('wartet');
    expect(result.current.lebenszeichenFehler).toBeNull();
  });

  it('ein „erneut versuchen“ aus einem anderen Tab (storage-Ereignis) beendet das „still“ ebenso', async () => {
    const { result } = await stillGeworden();
    expect(result.current.laufzeit?.rolle).toBe('still');
    delete falsch.rpcFehler.hall_speaker_heartbeat;
    heartbeat([{ field: 1, status: 'ok' }]);
    andererTab('hallenton:erneut', '123-1');
    await warten();
    expect(result.current.laufzeit?.rolle).toBe('wartet');
    expect(result.current.lebenszeichenFehler).toBeNull();
  });

  it('eine erfolgreiche Neu-Anmeldung dieses Tabs (erneutVersuchen(false)) beendet das „still“, ohne andere Tabs anzustoßen', async () => {
    const { result } = await stillGeworden();
    delete falsch.rpcFehler.hall_speaker_heartbeat;
    heartbeat([{ field: 1, status: 'ok' }]);
    act(() => { erneutVersuchen(false); });
    await warten();
    expect(result.current.laufzeit?.rolle).toBe('wartet');
    expect(speicher.getItem('hallenton:erneut')).toBeNull();
  });

  it('ein neues Zugangs-Token (TOKEN_REFRESHED/SIGNED_IN) beendet das „still“; dasselbe Token tut nichts', async () => {
    einschalten();
    falsch.rpcFehler.hall_speaker_heartbeat = '42501';
    const mitToken = (token: string) => (
      <AuthContext.Provider value={{ session: { token } } as unknown as AuthContextValue}><HallLautsprecherLaufzeit /></AuthContext.Provider>
    );
    const { result } = renderHook(() => useHallLautsprecher(TID));
    const baustein = render(mitToken('alt'));
    await warten();
    await vor(11_000);
    expect(result.current.laufzeit?.rolle).toBe('still');
    baustein.rerender(mitToken('alt')); // kein neues Token: weiter still
    await warten();
    expect(result.current.laufzeit?.rolle).toBe('still');
    delete falsch.rpcFehler.hall_speaker_heartbeat;
    heartbeat([{ field: 1, status: 'ok' }]);
    baustein.rerender(mitToken('neu')); // das Konto hat sich erneuert
    await warten();
    expect(result.current.laufzeit?.rolle).toBe('wartet');
    expect(result.current.lebenszeichenFehler).toBeNull();
  });

  it('Gegenbeispiel: läuft das Gerät normal, ändert „erneut versuchen“ nichts (kein Neustart, kein zusätzliches Lebenszeichen)', async () => {
    einschalten();
    heartbeat([{ field: 1, status: 'ok' }]);
    const { result } = renderHook(() => useHallLautsprecher(TID));
    render(<HallLautsprecherLaufzeit />);
    await warten();
    const bisher = heartbeats();
    act(() => { result.current.erneutVersuchen(); });
    await warten();
    expect(heartbeats()).toBe(bisher);
    expect(result.current.laufzeit?.rolle).toBe('wartet');
  });
});

describe('@HT-023 Anhören am Hook: „belegt“, wenn eine echte Hymne läuft', () => {
  it('echte Torhymne läuft → hierAnhoeren(„tor“) und hierAnhoeren(„abpfiff“) liefern „belegt“, die Hymne läuft weiter', async () => {
    const { result } = renderHook(() => useHallLautsprecher(TID));
    falsch.rpcDaten.hall_sound_status = {
      serverNow: 0, closed: false, speakers: [], leads: [],
      settings: { halftimeSound: 'horn-1', halftimeCustomPath: null, endCustomPath: null, goalToneFields: [1], goalAnthemPaths: [`${TID}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.mp3`] },
    };
    let erst: boolean | 'belegt' = false;
    await act(async () => { erst = await result.current.hierAnhoeren('tor'); }); // lädt Hymne und Hupen, spielt die Vorschau
    expect(erst).toBe(true);
    const spieler = (await import('../lautsprecherGeraet')).geraetSpieler();
    expect(spieler.hymnen.spielen(0)).toBe(true); // jetzt läuft eine echte Hymne
    const hymne = kontext.quellen.at(-1);
    const anzahl = kontext.quellen.length;
    let antwort: boolean | 'belegt' = false;
    await act(async () => { antwort = await result.current.hierAnhoeren('tor'); });
    expect(antwort).toBe('belegt');
    await act(async () => { antwort = await result.current.hierAnhoeren('abpfiff'); });
    expect(antwort).toBe('belegt');
    expect(kontext.quellen).toHaveLength(anzahl);
    expect(hymne?.stops.at(-1)).toBe((hymne?.starts[0] ?? 0) + 10); // nur die harte Grenze
    expect(spieler.hymnen.laeuft()).toBe(true);
  });
});
