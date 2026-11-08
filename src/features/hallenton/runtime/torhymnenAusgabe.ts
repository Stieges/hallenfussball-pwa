/**
 * Torhymnen im Spieler des Hallen-Lautsprechers (H3c, @HT-024, @HT-023), Teil von `hallTonSpieler.ts` auf derselben Ausgabe:
 *
 * - `laden(urls)`: alle Hymnen vorab dekodieren, über die öffentliche Storage-Adresse (nur `https:`, kein `blob:`/`data:` –
 *   CSP). Lädt eine nicht, ist sie nicht spielbar und wird übersprungen; lädt keine, gibt es keinen Tor-Ton. Kein Rückfall
 *   auf eine Hupe und kein Zustand `custom_sound_failed` deswegen (gilt nach Vorschlag, Brief H3c).
 * - `spielen(i)`: sofort, über den eigenen Regler `tor` (`GainNode`) → Begrenzer → Ausgang; harte Grenze 10 s, auch bei
 *   einer längeren Datei. Nicht, solange auf dem Gerät gerade ein anderer Ton klingt (ein Ende geht vor, Regel 4).
 * - Jeder andere Ton des Geräts (End-Ton, Testton, „Anhören“) beendet die Hymne genau zu seinem Beginn – auch einer, der
 *   schon vor der Hymne geplant war; wird er abgebrochen, gilt wieder die harte Grenze (`toeneGeaendert`).
 * - `stoppen()`: von außen sofort (Rücknahme, Ende, Abschalten).
 * Alle Zeiten Audiozeit (s).
 */
import { TORHYMNE_MAX_MS } from '../../../core/hallenton';
import type { AudioKontext, AudioPuffer, GainKnoten, KompressorKnoten, QuellKnoten } from './webAudioTypen';

export const HYMNE_HART_STOPP_SEK = TORHYMNE_MAX_MS / 1000;

/** Ein anderer Ton auf derselben Ausgabe: Beginn und Ende in Audiozeit. */
export interface AndererTon {
  startAt: number;
  endetUm: number;
}

export interface TorhymnenAusgabe {
  /** Lädt die Liste; Ergebnis je Hymne: spielbar? Ein späterer Aufruf ersetzt einen früheren. */
  laden(urls: readonly string[]): Promise<readonly boolean[]>;
  /** Die zuletzt geladene Liste (Adressen) und je Hymne, ob sie spielbar ist. */
  liste(): readonly string[];
  spielbar(): readonly boolean[];
  /** Hymne `index` sofort spielen; `false`, wenn sie nicht spielbar ist oder gerade nichts erklingen darf. */
  spielen(index: number): boolean;
  stoppen(): void;
  laeuft(): boolean;
  /** Ein anderer Ton wurde geplant oder abgebrochen: Ende der laufenden Hymne neu setzen. */
  toeneGeaendert(): void;
  setzeLautstaerke(prozent: number): void;
}

export interface TorhymnenAusgabeDeps {
  kontext: () => AudioKontext;
  begrenzer: () => KompressorKnoten;
  dekodiere: (url: string) => Promise<AudioPuffer | null>;
  /** Darf jetzt etwas erklingen (aktiviert, nicht stumm, Regler `tor` über 0)? */
  darf: () => boolean;
  /** Regler `tor` in Prozent. */
  lautstaerke: () => number;
  andereToene: () => Iterable<AndererTon>;
}

export function istHttps(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

interface Laufend {
  quelle: QuellKnoten;
  gain: GainKnoten;
  startAt: number;
  /** Ende der Datei, höchstens 10 s nach dem Beginn. */
  dateiEnde: number;
  /** Zuletzt gesetzte Stoppzeit. */
  stopAt: number;
  gestoppt: boolean;
}

export function erzeugeTorhymnenAusgabe(deps: TorhymnenAusgabeDeps): TorhymnenAusgabe {
  let liste: readonly string[] = [];
  let puffer: readonly (AudioPuffer | null)[] = [];
  let runde = 0;
  let laufend: Laufend | null = null;

  const laeuft = (): boolean => laufend !== null && !laufend.gestoppt
    && deps.kontext().currentTime < Math.min(laufend.dateiEnde, laufend.stopAt);

  /** Ende = harte Grenze oder der Beginn des ersten anderen Tons ab dem Beginn der Hymne, was früher ist. */
  const begrenzen = (): void => {
    if (!laufend || !laeuft()) {
      return;
    }
    let ziel = laufend.startAt + HYMNE_HART_STOPP_SEK;
    for (const ton of deps.andereToene()) {
      if (ton.startAt >= laufend.startAt) {
        ziel = Math.min(ziel, ton.startAt);
      }
    }
    if (ziel !== laufend.stopAt) {
      laufend.stopAt = ziel;
      laufend.quelle.stop(ziel); // der letzte Aufruf gilt (Web Audio), solange die Quelle noch klingt
    }
  };

  const stoppen = (): void => {
    if (!laufend || !laeuft()) {
      return;
    }
    const jetzt = deps.kontext().currentTime;
    laufend.gestoppt = true;
    laufend.stopAt = jetzt;
    laufend.quelle.stop(jetzt);
  };

  return {
    async laden(urls) {
      const meine = ++runde;
      const neu = await Promise.all(urls.map((url) => (istHttps(url) ? deps.dekodiere(url) : Promise.resolve(null))));
      if (meine === runde) {
        liste = [...urls];
        puffer = neu;
      }
      return neu.map((p) => p !== null);
    },
    liste: () => liste,
    spielbar: () => puffer.map((p) => p !== null),
    spielen(index) {
      const ton = puffer[index] ?? null;
      if (!ton || !deps.darf()) {
        return false;
      }
      const k = deps.kontext();
      const jetzt = k.currentTime;
      for (const anderer of deps.andereToene()) {
        if (anderer.startAt <= jetzt && jetzt < anderer.endetUm) {
          return false; // ein anderer Ton klingt gerade (z. B. der Abpfiff)
        }
      }
      stoppen();
      const quelle = k.createBufferSource();
      const gain = k.createGain();
      quelle.buffer = ton;
      gain.gain.value = deps.lautstaerke() / 100;
      quelle.connect(gain);
      gain.connect(deps.begrenzer());
      const eintrag: Laufend = {
        quelle, gain, startAt: jetzt, dateiEnde: jetzt + Math.min(ton.duration, HYMNE_HART_STOPP_SEK), stopAt: Number.POSITIVE_INFINITY, gestoppt: false,
      };
      quelle.onended = () => {
        if (laufend === eintrag) {
          laufend = null;
        }
        quelle.disconnect();
        gain.disconnect();
      };
      laufend = eintrag;
      quelle.start(jetzt);
      begrenzen();
      return true;
    },
    stoppen,
    laeuft,
    toeneGeaendert: begrenzen,
    setzeLautstaerke(prozent) {
      if (laufend) {
        laufend.gain.gain.value = prozent / 100;
      }
    },
  };
}
