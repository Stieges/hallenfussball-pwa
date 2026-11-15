/**
 * Test-Hilfe Hallenton (H3b-2b): ein gefälschtes Gerät mit mehreren Tabs – gemeinsamer `localStorage`, `BroadcastChannel`
 * (eine Nachricht erreicht alle anderen Kanäle desselben Namens, nicht den eigenen) und Web Locks (`navigator.locks`:
 * exklusiv, `ifAvailable`, Warteschlange, Abbruch per Signal). Gibt ein Tab die Sperre frei (Tab geschlossen), bekommt sie
 * der nächste wartende Tab.
 */
import type { KanalSpeicher, NachrichtenKanal } from '../../features/hallenton/runtime/lautsprecherKanal';
import type { SpeicherEreignisse } from '../../features/hallenton/runtime/ausgang/ausgangWahl';
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
  /** Je Sperren-Name (H3b-3: Ton-Sperre `hallenton` und Melde-Sperre `hallenton-melden` sind getrennt). */
  private readonly halter = new Map<string, object>();
  private readonly schlangen = new Map<string, Wartend[]>();
  anfragen = 0;

  request(name: string, options: { ifAvailable?: boolean; signal?: AbortSignal }, fn: (lock: unknown) => Promise<void>): Promise<unknown> {
    this.anfragen += 1;
    if (options.ifAvailable) {
      return this.halter.has(name) ? fn(null) : this.gewaehren(name, fn);
    }
    return new Promise((resolve, reject) => {
      const wartend: Wartend = { fn, resolve };
      const schlange = this.schlange(name);
      options.signal?.addEventListener('abort', () => {
        const i = schlange.indexOf(wartend);
        if (i >= 0) {
          schlange.splice(i, 1);
          reject(new DOMException('Aborted', 'AbortError'));
        }
      });
      if (this.halter.has(name)) {
        schlange.push(wartend);
      } else {
        resolve(this.gewaehren(name, fn));
      }
    });
  }

  gehalten(name = 'hallenton'): boolean {
    return this.halter.has(name);
  }

  private schlange(name: string): Wartend[] {
    let liste = this.schlangen.get(name);
    if (!liste) {
      liste = [];
      this.schlangen.set(name, liste);
    }
    return liste;
  }

  private gewaehren(name: string, fn: (lock: unknown) => Promise<void>): Promise<void> {
    const lock = {};
    this.halter.set(name, lock);
    return fn(lock).finally(() => {
      if (this.halter.get(name) === lock) {
        this.halter.delete(name);
        const naechster = this.schlange(name).shift();
        if (naechster) {
          naechster.resolve(this.gewaehren(name, naechster.fn));
        }
      }
    });
  }
}

export class FalschesGeraet<S extends KanalSpeicher = FalscherSpeicher> {
  /** Standard: ein eigener Speicher; H3b-3 kann den `localStorage` der Testumgebung einsetzen (Regel 3 im Cockpit-Hook). */
  constructor(readonly speicher: S = new FalscherSpeicher() as unknown as S) {}
  readonly sperren = new FalscherSperrVerwalter();
  private readonly kanaele = new Set<{ zuhoerer: Set<() => void>; offen: boolean }>();
  nachrichten = 0;

  private readonly seiten = new Set<Set<(ereignis: { key: string | null }) => void>>();

  /**
   * Eine Seite (Tab) mit eigenem Blick auf den gemeinsamen Speicher (H4-6): schreibt sie einen geänderten Wert, bekommen die
   * ANDEREN Seiten das `storage`-Ereignis (wie der Browser; die schreibende Seite bekommt keines).
   */
  neueSeite(): { speicher: KanalSpeicher; seite: SpeicherEreignisse } {
    const eigene = new Set<(ereignis: { key: string | null }) => void>();
    this.seiten.add(eigene);
    const basis = this.speicher;
    const melden = (key: string): void => {
      for (const andere of this.seiten) {
        if (andere !== eigene) {
          for (const fn of [...andere]) {
            fn({ key });
          }
        }
      }
    };
    return {
      speicher: {
        getItem: (k) => basis.getItem(k),
        setItem: (k, v) => {
          const alt = basis.getItem(k);
          basis.setItem(k, v);
          if (alt !== v) {
            melden(k);
          }
        },
        removeItem: (k) => {
          const hatte = basis.getItem(k) !== null;
          basis.removeItem(k);
          if (hatte) {
            melden(k);
          }
        },
      },
      seite: {
        addEventListener: (_type, fn) => {
          eigene.add(fn);
        },
        removeEventListener: (_type, fn) => {
          eigene.delete(fn);
        },
      },
    };
  }

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
