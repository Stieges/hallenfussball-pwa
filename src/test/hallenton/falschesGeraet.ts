/**
 * Test-Hilfe Hallenton (H3b-2b): ein gefälschtes Gerät mit mehreren Tabs – gemeinsamer `localStorage`, `BroadcastChannel`
 * (eine Nachricht erreicht alle anderen Kanäle desselben Namens, nicht den eigenen) und Web Locks (`navigator.locks`:
 * exklusiv, `ifAvailable`, Warteschlange, Abbruch per Signal). Gibt ein Tab die Sperre frei (Tab geschlossen), bekommt sie
 * der nächste wartende Tab.
 */
import type { KanalSpeicher, NachrichtenKanal } from '../../features/hallenton/runtime/lautsprecherKanal';
import type { SperrVerwalter } from '../../features/hallenton/runtime/geraeteSperre';

export class FalscherSpeicher implements KanalSpeicher {
  readonly werte = new Map<string, string>();
  getItem(schluessel: string): string | null {
    return this.werte.get(schluessel) ?? null;
  }
  setItem(schluessel: string, wert: string): void {
    this.werte.set(schluessel, wert);
  }
  removeItem(schluessel: string): void {
    this.werte.delete(schluessel);
  }
}

interface Wartend {
  fn: (lock: unknown) => Promise<void>;
  resolve: (wert: unknown) => void;
}

export class FalscherSperrVerwalter implements SperrVerwalter {
  private halter: object | null = null;
  private readonly schlange: Wartend[] = [];
  anfragen = 0;

  request(_name: string, options: { ifAvailable?: boolean; signal?: AbortSignal }, fn: (lock: unknown) => Promise<void>): Promise<unknown> {
    this.anfragen += 1;
    if (options.ifAvailable) {
      return this.halter ? fn(null) : this.gewaehren(fn);
    }
    return new Promise((resolve, reject) => {
      const wartend: Wartend = { fn, resolve };
      options.signal?.addEventListener('abort', () => {
        const i = this.schlange.indexOf(wartend);
        if (i >= 0) {
          this.schlange.splice(i, 1);
          reject(new DOMException('Aborted', 'AbortError'));
        }
      });
      if (this.halter) {
        this.schlange.push(wartend);
      } else {
        resolve(this.gewaehren(fn));
      }
    });
  }

  gehalten(): boolean {
    return this.halter !== null;
  }

  private gewaehren(fn: (lock: unknown) => Promise<void>): Promise<void> {
    const lock = {};
    this.halter = lock;
    return fn(lock).finally(() => {
      if (this.halter === lock) {
        this.halter = null;
        const naechster = this.schlange.shift();
        if (naechster) {
          naechster.resolve(this.gewaehren(naechster.fn));
        }
      }
    });
  }
}

export class FalschesGeraet {
  readonly speicher = new FalscherSpeicher();
  readonly sperren = new FalscherSperrVerwalter();
  private readonly kanaele = new Set<{ zuhoerer: Set<() => void>; offen: boolean }>();
  nachrichten = 0;

  /** Neuer `BroadcastChannel('hallenton')` eines Tabs. */
  kanal(): NachrichtenKanal {
    const eigener = { zuhoerer: new Set<() => void>(), offen: true };
    this.kanaele.add(eigener);
    return {
      postMessage: () => {
        this.nachrichten += 1;
        for (const k of this.kanaele) {
          if (k !== eigener && k.offen) {
            for (const fn of [...k.zuhoerer]) {
              fn();
            }
          }
        }
      },
      addEventListener: (_type, fn) => {
        eigener.zuhoerer.add(fn);
      },
      removeEventListener: (_type, fn) => {
        eigener.zuhoerer.delete(fn);
      },
      close: () => {
        eigener.offen = false;
        this.kanaele.delete(eigener);
      },
    };
  }
}
