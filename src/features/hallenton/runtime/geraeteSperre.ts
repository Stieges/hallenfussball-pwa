/**
 * Sperre `hallenton` je Gerät (H3b-2b, @HT-033 Zeile 8, Plan „Schutz“): Nur der Tab mit der Sperre tönt; ein Tab ohne sie
 * meldet `belegt` („Lautsprecher läuft schon in einem anderen Fenster“) und wartet. Schließt der Tab mit der Sperre, gibt der
 * Browser sie frei und der nächste wartende Tab bekommt `erhalten`. Je Gerät, nicht je Turnier: ein Gerät ist für höchstens
 * ein Turnier Lautsprecher.
 *
 * Über Web Locks (`navigator.locks`): erst `ifAvailable` (sofort wissen, ob ein anderer Tab tönt), sonst warten.
 * Ohne `navigator.locks` (Browser vor 2022, z. B. Safari < 15.4): dieser Tab tönt ohne Schutz vor einem zweiten Tab
 * (Begründung im Bericht H3b-2b: alle Zielbrowser von @HT-029 haben Web Locks; ein Ersatz über `localStorage` hätte eigene
 * Wettläufe).
 */
export const SPERRE_NAME = 'hallenton';

export type SperrMeldung = 'erhalten' | 'belegt';

export interface GeraeteSperre {
  /** Fordert die Sperre an; `melde` erfährt `belegt` (wartet) und `erhalten`. Die Rückgabe gibt sie frei bzw. hört auf zu warten. */
  anfordern(melde: (meldung: SperrMeldung) => void): () => void;
}

/** Ausschnitt von `LockManager`. */
export interface SperrVerwalter {
  request(name: string, options: { ifAvailable?: boolean; signal?: AbortSignal }, fn: (lock: unknown) => Promise<void>): Promise<unknown>;
}

/** `name`: die Ton-Sperre `hallenton` (Standard) oder die Melde-Sperre des Lebenszeichens (`hallenton-melden`, H3b-3). */
export function erzeugeGeraeteSperre(verwalter: SperrVerwalter | null, name: string = SPERRE_NAME): GeraeteSperre {
  return {
    anfordern(melde) {
      if (verwalter === null) {
        melde('erhalten');
        return () => undefined;
      }
      let freigeben: () => void = () => undefined;
      const gehalten = new Promise<void>((resolve) => {
        freigeben = resolve;
      });
      const abbruch = new AbortController();
      let vorbei = false;
      const halten = async (): Promise<void> => {
        if (!vorbei) {
          melde('erhalten');
        }
        await gehalten;
      };
      void verwalter.request(name, { ifAvailable: true }, async (lock) => {
        if (lock) {
          await halten();
          return;
        }
        if (vorbei) {
          return;
        }
        melde('belegt');
        void verwalter.request(name, { signal: abbruch.signal }, halten).catch(() => undefined);
      }).catch(() => undefined);
      return () => {
        vorbei = true;
        abbruch.abort();
        freigeben();
      };
    },
  };
}

/** Sperre des Browsers; ohne Web Locks der Rückfall oben. */
export function erzeugeBrowserSperre(name: string = SPERRE_NAME): GeraeteSperre {
  const locks = typeof navigator !== 'undefined' && 'locks' in navigator ? (navigator.locks as SperrVerwalter | undefined) : undefined;
  return erzeugeGeraeteSperre(locks ?? null, name);
}
