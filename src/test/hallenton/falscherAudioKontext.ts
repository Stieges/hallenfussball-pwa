/**
 * Test-Fälschung eines AudioContext (H3b-1): zeichnet Knoten, Verbindungen und `start(t)`/`stop(t)` auf. Die Zeit
 * (`currentTime`), `outputLatency` und der Zustand werden von Hand gesetzt. Dekodieren: die Länge eines Tons steht im
 * ersten Byte der Daten (Sekunden); ein erstes Byte 255 lässt das Dekodieren scheitern.
 *
 * H4-6 (G11, Ausgang): `sinkId`/`setSinkId` (wie Chrome: nur vorhandene Ausgänge, sonst `NotFoundError`; `setSinkId` fehlt,
 * wenn `ohneSetSinkId`), Ereignis `sinkchange`, und `ausgangVerschwindet(id)`: der Browser meldet das Abziehen, die Ausgabe auf
 * diesem Ausgang steht still (`suspended`, V-AUSGANG Teil 2). Ohne Aufruf von `setSinkId` bleibt `sinkId` `''` (Standard).
 */
import type { AudioKontext, AudioPuffer, AudioZiel } from '../../features/hallenton/runtime/hallTonSpieler';

export interface FalscheQuelle {
  buffer: AudioPuffer | null;
  starts: number[];
  stops: Array<number | undefined>;
  ziele: AudioZiel[];
  getrennt: boolean;
  onended: ((ereignis: Event) => unknown) | null;
}

export interface FalscherGain {
  gain: { value: number };
  ziele: AudioZiel[];
  getrennt: boolean;
}

export class FalscherAudioKontext implements AudioKontext {
  currentTime = 0;
  outputLatency: number | undefined = 0;
  state = 'suspended';
  readonly destination: AudioZiel = { name: 'destination' };
  readonly quellen: FalscheQuelle[] = [];
  readonly gains: FalscherGain[] = [];
  readonly kompressoren: Array<{ ziele: AudioZiel[]; threshold: { value: number }; ratio: { value: number } }> = [];
  resumeAufrufe = 0;
  /** `false`: `resume()` lässt den Zustand auf „suspended“ (Browser verweigert ohne Geste). */
  resumeErlaubt = true;
  private readonly zuhoerer = new Set<() => void>();
  private readonly sinkZuhoerer = new Set<() => void>();
  /** Aktueller Ausgang: `''` = Standard des Systems (Browser ohne Wahl). */
  sinkId: string | { readonly type: string } = '';
  /** Alle Aufrufe von `setSinkId` mit der übergebenen Kennung (auch gescheiterte). */
  readonly setSinkIdAufrufe: string[] = [];
  /** Ausgänge, die es gibt (Kennungen); `null` = jede Kennung gilt. Eine fehlende Kennung lässt `setSinkId` scheitern. */
  vorhandeneAusgaenge: Set<string> | null = null;
  /** Browser ohne Ausgangswahl (Safari, Firefox): `setSinkId` fehlt. */
  setSinkId?: (kennung: string) => Promise<void> = (kennung) => this.sinkSetzen(kennung);

  /** Browser ohne Ausgangswahl nachstellen (`setSinkId` fehlt, `sinkId` fehlt). */
  ohneSetSinkId(): void {
    this.setSinkId = undefined;
  }

  /** `setSinkId` antwortet nie. */
  setSinkIdHaengt = false;

  private sinkSetzen(kennung: string): Promise<void> {
    this.setSinkIdAufrufe.push(kennung);
    if (this.setSinkIdHaengt) {
      return new Promise(() => undefined);
    }
    if (kennung !== '' && this.vorhandeneAusgaenge !== null && !this.vorhandeneAusgaenge.has(kennung)) {
      return Promise.reject(new DOMException(`Kein Ausgang mit der Kennung ${kennung}`, 'NotFoundError'));
    }
    const geaendert = this.sinkId !== kennung;
    this.sinkId = kennung;
    if (geaendert) {
      queueMicrotask(() => this.sinkchangeMelden());
    }
    return Promise.resolve();
  }

  private sinkchangeMelden(): void {
    for (const fn of [...this.sinkZuhoerer]) {
      fn();
    }
  }

  /** Der Ausgang `kennung` wird abgezogen: die Ausgabe darauf steht still (`suspended`), der Ausgang ist weg. */
  ausgangVerschwindet(kennung: string): void {
    this.vorhandeneAusgaenge?.delete(kennung);
    if (this.sinkId === kennung) {
      this.zustandSetzen('suspended');
    }
  }

  /** Der Browser wechselt von selbst auf einen anderen Ausgang (`sinkchange`, nicht durch die App). */
  ausgangWechseltVonAussen(kennung: string): void {
    this.sinkId = kennung;
    this.sinkchangeMelden();
  }

  resume(): Promise<void> {
    this.resumeAufrufe += 1;
    if (this.resumeErlaubt) {
      this.zustandSetzen('running');
    }
    return Promise.resolve();
  }

  decodeAudioData(daten: ArrayBuffer): Promise<AudioPuffer> {
    const sekunden = new Uint8Array(daten)[0] ?? 0;
    if (sekunden === 255) {
      return Promise.reject(new Error('EncodingError'));
    }
    return Promise.resolve({ duration: sekunden });
  }

  createBufferSource() {
    const quelle: FalscheQuelle = { buffer: null, starts: [], stops: [], ziele: [], getrennt: false, onended: null };
    this.quellen.push(quelle);
    return {
      get buffer() { return quelle.buffer; },
      set buffer(wert: AudioPuffer | null) { quelle.buffer = wert; },
      get onended() { return quelle.onended; },
      set onended(fn: ((ereignis: Event) => unknown) | null) { quelle.onended = fn; },
      connect: (ziel: AudioZiel) => { quelle.ziele.push(ziel); return ziel; },
      disconnect: () => { quelle.getrennt = true; },
      start: (wann?: number) => { quelle.starts.push(wann ?? 0); },
      stop: (wann?: number) => { quelle.stops.push(wann); },
    };
  }

  createGain() {
    const gain: FalscherGain = { gain: { value: 1 }, ziele: [], getrennt: false };
    this.gains.push(gain);
    return {
      gain: gain.gain,
      connect: (ziel: AudioZiel) => { gain.ziele.push(ziel); return ziel; },
      disconnect: () => { gain.getrennt = true; },
    };
  }

  createDynamicsCompressor() {
    const kompressor = { ziele: [] as AudioZiel[], threshold: { value: 0 }, ratio: { value: 1 } };
    this.kompressoren.push(kompressor);
    return {
      threshold: kompressor.threshold,
      knee: { value: 0 },
      ratio: kompressor.ratio,
      attack: { value: 0 },
      release: { value: 0 },
      connect: (ziel: AudioZiel) => { kompressor.ziele.push(ziel); return ziel; },
      disconnect: () => undefined,
    };
  }

  addEventListener(type: 'statechange' | 'sinkchange', fn: () => void): void {
    (type === 'sinkchange' ? this.sinkZuhoerer : this.zuhoerer).add(fn);
  }

  removeEventListener(type: 'statechange' | 'sinkchange', fn: () => void): void {
    (type === 'sinkchange' ? this.sinkZuhoerer : this.zuhoerer).delete(fn);
  }

  /** Zustand ändern und `statechange` auslösen (wie der Browser). */
  zustandSetzen(neu: string): void {
    if (neu === this.state) {
      return;
    }
    this.state = neu;
    for (const fn of this.zuhoerer) {
      fn();
    }
  }

  /** Alle Quellen melden „ended“ (Ende des Tons). */
  endeMelden(): void {
    for (const quelle of this.quellen) {
      quelle.onended?.(new Event('ended'));
    }
  }
}

/** Daten eines Tons mit der Länge `sekunden` (siehe Kopf); 255 = nicht dekodierbar. */
export function tonDaten(sekunden: number): ArrayBuffer {
  return new Uint8Array([sekunden]).buffer;
}
