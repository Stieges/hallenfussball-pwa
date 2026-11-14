/**
 * Torhymnen im Spieler des Hallen-Lautsprechers (H3c, @HT-024, @HT-023), Teil von `hallTonSpieler.ts` auf derselben Ausgabe:
 *
 * - `laden(urls)`: alle Hymnen vorab dekodieren, über die öffentliche Storage-Adresse (nur `https:`, kein `blob:`/`data:` –
 *   CSP). Lädt eine nicht, ist sie nicht spielbar und wird übersprungen; lädt keine, gibt es keinen Tor-Ton. Kein Rückfall
 *   auf eine Hupe und kein Zustand `custom_sound_failed` deswegen (gilt nach Vorschlag, Brief H3c).
 * - `spielen(i)`: sofort, über den eigenen Regler `tor` (`GainNode`) → Begrenzer → Ausgang; harte Grenze 10 s, auch bei
 *   einer längeren Datei. Nicht, solange auf dem Gerät gerade ein anderer Ton klingt (ein Ende geht vor, Regel 4).
 * - Jeder andere echte Ton des Geräts (End-Ton, Testton; nicht „Anhören“, das weicht) beendet die Hymne genau zu seinem Beginn – auch einer, der
 *   schon vor der Hymne geplant war; wird er abgebrochen, gilt wieder die harte Grenze (`toeneGeaendert`).
 * - `stoppen()`: von außen sofort (Rücknahme, Ende, Abschalten).
 * - `anhoeren(i)` (H4-1, H3c-Befund 4): „Anhören“ als eigene Art. Sie verdrängt keine echte Hymne (läuft eine, kommt `'belegt'`),
 *   zählt nie als „läuft“ und wird von der nächsten echten Ausgabe sofort beendet; `stoppen()` (Rücknahme) rührt sie nicht an.
 * - `nachladen()` (Fixrunde 1): nur die nicht spielbaren Hymnen der aktuellen Liste erneut holen (z. B. nach kurzem
 *   WLAN-Aussetzer beim Aktivieren); den Abstand der Versuche hält die Steuerung.
 * Alle Zeiten Audiozeit (s).
 */
import { TORHYMNE_MAX_MS } from '../../../core/hallenton';
import type { AnhoerenErgebnis } from './hallTonVorschau';
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
  /** Nur die nicht spielbaren Hymnen der zuletzt geladenen Liste erneut holen; Ergebnis wie `laden`. */
  nachladen(): Promise<readonly boolean[]>;
  /** Die zuletzt geladene Liste (Adressen) und je Hymne, ob sie spielbar ist. */
  liste(): readonly string[];
  spielbar(): readonly boolean[];
  /** Hymne `index` sofort spielen; `false`, wenn sie nicht spielbar ist oder gerade nichts erklingen darf. */
  spielen(index: number): boolean;
  stoppen(): void;
  /** Wie `spielen`, aber als Vorschau auf diesem Gerät: `'belegt'`, solange eine echte Hymne oder ein anderer Ton klingt. */
  anhoeren(index: number): AnhoerenErgebnis;
  anhoerenStoppen(): void;
  /** Nur eine echte Hymne (nie das Anhören). */
  laeuft(): boolean;
  /** Ein anderer Ton wurde geplant oder abgebrochen: Ende der laufenden Hymne neu setzen. */
  toeneGeaendert(): void;
  setzeLautstaerke(prozent: number): void;
}

export interface TorhymnenAusgabeDeps {
  kontext: () => AudioKontext;
  begrenzer: () => KompressorKnoten;
  dekodiere: (url: string) => Promise<AudioPuffer | null>;
  /** Darf jetzt etwas erklingen (aktiviert, Regler `tor` über 0)? */
  darf: () => boolean;
  /** Regler `tor` in Prozent. */
  lautstaerke: () => number;
  andereToene: () => Iterable<AndererTon>;
  /** Eine echte Hymne beginnt: ein laufendes Anhören der Hupen endet (die des Spielers). */
  vorschauBeenden?: () => void;
}

export function istHttps(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

/** `stop()` wie in `hallTonSpieler.abbrechen` abgesichert: ein Wurf darf nie den Weg eines End-Tons stören (Regel 4). */
function stopUm(quelle: QuellKnoten, wann: number): void {
  try {
    quelle.stop(wann);
  } catch {
    // schon beendet
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

  let anhoerenLaufend: Laufend | null = null;

  const klingt = (e: Laufend | null): e is Laufend => e !== null && !e.gestoppt
    && deps.kontext().currentTime < Math.min(e.dateiEnde, e.stopAt);

  const laeuft = (): boolean => klingt(laufend);

  /** Ende = harte Grenze oder der Beginn des ersten anderen Tons ab dem Beginn der Hymne, was früher ist (echte Hymne und Anhören). */
  const begrenzen = (): void => {
    for (const e of [laufend, anhoerenLaufend]) {
      if (!klingt(e)) {
        continue;
      }
      let ziel = e.startAt + HYMNE_HART_STOPP_SEK;
      for (const ton of deps.andereToene()) {
        if (ton.startAt >= e.startAt) {
          ziel = Math.min(ziel, ton.startAt);
        }
      }
      if (ziel !== e.stopAt) {
        e.stopAt = ziel;
        stopUm(e.quelle, ziel); // der letzte Aufruf gilt (Web Audio), solange die Quelle noch klingt
      }
    }
  };

  const stoppeEintrag = (e: Laufend | null): void => {
    if (!klingt(e)) {
      return;
    }
    const jetzt = deps.kontext().currentTime;
    e.gestoppt = true;
    e.stopAt = jetzt;
    stopUm(e.quelle, jetzt);
  };

  const stoppen = (): void => stoppeEintrag(laufend);
  const anhoerenStoppen = (): void => stoppeEintrag(anhoerenLaufend);

  /** Läuft jetzt ein anderer Ton (z. B. der Abpfiff)? */
  const andererKlingt = (jetzt: number): boolean => {
    for (const anderer of deps.andereToene()) {
      if (anderer.startAt <= jetzt && jetzt < anderer.endetUm) {
        return true;
      }
    }
    return false;
  };

  /** Hymne `ton` jetzt starten; `echt` = die Torhymne, sonst das Anhören. */
  const abspielen = (ton: AudioPuffer, echt: boolean): void => {
    const k = deps.kontext();
    const jetzt = k.currentTime;
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
      if (anhoerenLaufend === eintrag) {
        anhoerenLaufend = null;
      }
      quelle.disconnect();
      gain.disconnect();
    };
    if (echt) {
      laufend = eintrag;
    } else {
      anhoerenLaufend = eintrag;
    }
    quelle.start(jetzt);
    begrenzen();
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
    async nachladen() {
      const meine = runde;
      const urls = liste;
      const neu = await Promise.all(puffer.map((p, i): Promise<AudioPuffer | null> => (p ? Promise.resolve(p) : istHttps(urls[i]) ? deps.dekodiere(urls[i]) : Promise.resolve(null))));
      if (meine === runde && urls === liste) {
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
      if (andererKlingt(deps.kontext().currentTime)) {
        return false; // ein anderer Ton klingt gerade (z. B. der Abpfiff)
      }
      anhoerenStoppen(); // jede echte Ausgabe beendet ein laufendes Anhören sofort
      deps.vorschauBeenden?.();
      stoppen();
      abspielen(ton, true);
      return true;
    },
    anhoeren(index) {
      const ton = puffer[index] ?? null;
      if (!ton || !deps.darf()) {
        return false;
      }
      if (laeuft() || andererKlingt(deps.kontext().currentTime)) {
        return 'belegt'; // eine echte Ausgabe geht vor und läuft weiter
      }
      deps.vorschauBeenden?.();
      anhoerenStoppen();
      abspielen(ton, false);
      return true;
    },
    stoppen,
    anhoerenStoppen,
    laeuft,
    toeneGeaendert: begrenzen,
    setzeLautstaerke(prozent) {
      for (const e of [laufend, anhoerenLaufend]) {
        if (e) {
          e.gain.gain.value = prozent / 100;
        }
      }
    },
  };
}
