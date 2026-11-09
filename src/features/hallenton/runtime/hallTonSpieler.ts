/**
 * Web-Audio-Spieler des Hallen-Lautsprechers (H3b-1), hinter einer Schnittstelle, damit er im Test austauschbar ist.
 *
 * - `aktivieren()` nur aus einer Nutzergeste („Ton aktivieren“): ruft `resume()` sofort, ohne vorheriges `await`.
 *   Ohne Freigabe: Zustand `not_activated` (@HT-012).
 * - `laden()`: Töne der Tonwahl über `hallTonLader.ts` (Hupen, eigener Ton, Rückfall auf „Hupe 1“, @HT-028 Zeile 4); bei einem
 *   eigenen Ton, der nicht ladbar oder länger als 5 s ist, Zustand `custom_sound_failed`.
 * - `planen(id, art, t)`: `AudioBufferSourceNode.start(t)` → Lautstärke (`GainNode`) → Begrenzer (`DynamicsCompressorNode`)
 *   → Ausgang, harter Stopp nach 5 s. Dieselbe Kennung ersetzt den alten Ton.
 * - Lautstärke je Ton (auch Torhymne, Regler `tor`) und Stumm je Gerät in `localStorage` (`hallenton:lautstaerke`,
 *   `hallenton:stumm`), nicht turnierweit (@HT-023). Abpfiff-Ton auf 0 % oder stumm → Zustand `volume_zero` (@HT-039).
 * - H3c: Torhymnen (`hymnen`, `torhymnenAusgabe.ts`) auf derselben Ausgabe; jeder hier geplante Ton beendet sie zu seinem Beginn.
 */
import type { AudioKontext, AudioPuffer, GainKnoten, KompressorKnoten, QuellKnoten } from './webAudioTypen';
import { browserSpeicher, gespeicherteLautstaerke, lies, schreib, LAUTSTAERKE_SCHLUESSEL, STUMM_SCHLUESSEL, type ReglerArt, type Speicher, type TonArt } from './tonEinstellungen';
import { erzeugeHallTonLader, HART_STOPP_SEK, type LadeStand, type TonWahl } from './hallTonLader';
import { erzeugeTorhymnenAusgabe, type TorhymnenAusgabe } from './torhymnenAusgabe';

export type { AudioKontext, AudioPuffer, AudioZiel, GainKnoten, KompressorKnoten, QuellKnoten } from './webAudioTypen';
export { LAUTSTAERKE_SCHLUESSEL, STUMM_SCHLUESSEL, type ReglerArt, type Speicher, type TonArt } from './tonEinstellungen';

export { HART_STOPP_SEK, type HupenId, type LadeStand, type TonWahl } from './hallTonLader';
export type SpielerZustand = 'not_activated' | 'volume_zero' | 'custom_sound_failed' | 'ready';

export interface HallTonSpieler {
  aktivieren(): Promise<boolean>;
  laden(toene: Record<TonArt, TonWahl>): Promise<Record<TonArt, LadeStand>>;
  planen(id: string, art: TonArt, startAtAudioSec: number): boolean;
  abbrechen(id: string): void;
  /** Sofort spielen (Testton, „Anhören“). */
  jetztSpielen(art: TonArt): boolean;
  /** Audiozeit (s) für eine Serverzeit (ms), abzüglich `outputLatency`, wo vorhanden. */
  audioZeitFuerServerZeit(serverMs: number, serverNowMs: number): number;
  lautstaerke(art: ReglerArt): number;
  setzeLautstaerke(art: ReglerArt, prozent: number): void;
  stumm(): boolean;
  setzeStumm(stumm: boolean): void;
  zustand(): SpielerZustand;
  onZustand(fn: (zustand: SpielerZustand) => void): () => void;
  geplant(): string[];
  /** Für `ausgangsSignale` (dieselbe Ausgabe). */
  audioKontext(): AudioKontext;
  /** Torhymnen (@HT-024): laden, spielen, stoppen. */
  readonly hymnen: TorhymnenAusgabe;
}

export interface HallTonSpielerAbhaengigkeiten {
  erzeugeKontext: () => AudioKontext;
  ladeDaten: (url: string) => Promise<ArrayBuffer>;
  speicher: Speicher | null;
}

/** `startAt`/`endetUm`: Audiozeit von Beginn und hartem Ende (für die Torhymne). */
interface Geplant { quelle: QuellKnoten; gain: GainKnoten; art: TonArt; startAt: number; endetUm: number }

export function erzeugeHallTonSpieler({ erzeugeKontext, ladeDaten, speicher }: HallTonSpielerAbhaengigkeiten): HallTonSpieler {
  let kontextWert: AudioKontext | null = null;
  let begrenzerWert: KompressorKnoten | null = null;
  let aktiviert = false;
  let lautstaerke = gespeicherteLautstaerke(speicher);
  let stumm = lies(speicher, STUMM_SCHLUESSEL) === 'true';
  let puffer: Record<TonArt, AudioPuffer | null> = { abpfiff: null, halbzeit: null };
  let eigenerTonFehlt: Record<TonArt, boolean> = { abpfiff: false, halbzeit: false };
  let letzteWahl: Record<TonArt, TonWahl> | null = null;
  let ladeRunde = 0;
  let jetztZaehler = 0;
  let letzterZustand: SpielerZustand = 'not_activated';
  const geplant = new Map<string, Geplant>();
  const zuhoerer = new Set<(zustand: SpielerZustand) => void>();

  const berechne = (): SpielerZustand => {
    // @HT-012: ohne spielbaren Abpfiff-Ton gilt das Gerät ebenso als „Ton nicht aktiviert“ (der Klick lädt neu)
    if (!aktiviert || kontextWert?.state !== 'running' || puffer.abpfiff === null) {
      return 'not_activated';
    }
    if (stumm || lautstaerke.abpfiff === 0) {
      return 'volume_zero';
    }
    return eigenerTonFehlt.abpfiff || eigenerTonFehlt.halbzeit ? 'custom_sound_failed' : 'ready';
  };

  const bewerten = (): void => {
    const neu = berechne();
    if (neu !== letzterZustand) {
      letzterZustand = neu;
      for (const fn of [...zuhoerer]) {
        fn(neu);
      }
    }
  };

  const kontext = (): AudioKontext => {
    if (!kontextWert) {
      kontextWert = erzeugeKontext();
      kontextWert.addEventListener('statechange', bewerten);
    }
    return kontextWert;
  };

  const begrenzer = (): KompressorKnoten => {
    if (!begrenzerWert) {
      const k = kontext();
      begrenzerWert = k.createDynamicsCompressor();
      begrenzerWert.threshold.value = -3;
      begrenzerWert.knee.value = 0;
      begrenzerWert.ratio.value = 20;
      begrenzerWert.attack.value = 0.003;
      begrenzerWert.release.value = 0.25;
      begrenzerWert.connect(k.destination);
    }
    return begrenzerWert;
  };

  const trennen = (eintrag: Geplant): void => {
    eintrag.quelle.disconnect();
    eintrag.gain.disconnect();
  };

  const lader = erzeugeHallTonLader({ kontext, ladeDaten });
  const hymnen = erzeugeTorhymnenAusgabe({
    kontext, begrenzer, dekodiere: lader.dekodiere, andereToene: () => geplant.values(), lautstaerke: () => lautstaerke.tor,
    darf: () => aktiviert && kontextWert?.state === 'running' && !stumm && lautstaerke.tor > 0, // ohne geladenen Abpfiff-Ton
  });

  const abbrechen = (id: string): void => {
    const eintrag = geplant.get(id);
    if (!eintrag) {
      return;
    }
    geplant.delete(id);
    try {
      eintrag.quelle.stop(kontext().currentTime);
    } catch {
      // schon beendet
    }
    trennen(eintrag);
    hymnen.toeneGeaendert(); // die Hymne läuft wieder bis zu ihrer harten Grenze
  };

  // Ein Ton mit vergangener Startzeit spielt sofort (Web Audio): die 5-s-Regel von @HT-013 („kein altes Ende nachholen“)
  // muss deshalb der Planer halten, der Spieler prüft sie nicht.
  const planen = (id: string, art: TonArt, startAtAudioSec: number): boolean => {
    const ton = puffer[art];
    if (berechne() === 'not_activated' || stumm || lautstaerke[art] === 0 || !ton) {
      return false;
    }
    abbrechen(id);
    const k = kontext();
    const quelle = k.createBufferSource();
    const gain = k.createGain();
    quelle.buffer = ton;
    gain.gain.value = lautstaerke[art] / 100;
    quelle.connect(gain);
    gain.connect(begrenzer());
    const eintrag: Geplant = { quelle, gain, art, startAt: startAtAudioSec, endetUm: startAtAudioSec + Math.min(ton.duration, HART_STOPP_SEK) };
    quelle.onended = () => {
      if (geplant.get(id) === eintrag) {
        geplant.delete(id);
      }
      trennen(eintrag);
    };
    quelle.start(startAtAudioSec);
    quelle.stop(startAtAudioSec + HART_STOPP_SEK);
    geplant.set(id, eintrag);
    hymnen.toeneGeaendert(); // jeder Ton beendet eine laufende Hymne genau zu seinem Beginn (@HT-024)
    return true;
  };

  const laden = async (toene: Record<TonArt, TonWahl>): Promise<Record<TonArt, LadeStand>> => {
    letzteWahl = toene;
    const runde = ++ladeRunde;
    const { puffer: neuePuffer, eigenerTonFehlt: neuFehlt, stand } = await lader.ladeWahl(toene);
    if (runde === ladeRunde) {
      puffer = neuePuffer;
      eigenerTonFehlt = neuFehlt;
      bewerten();
    }
    return stand;
  };

  return {
    async aktivieren() {
      const k = kontext();
      const freigabe = k.resume(); // sofort in der Geste, vor jedem await
      aktiviert = true;
      try {
        await freigabe;
      } catch {
        // verweigert: der Zustand bleibt not_activated
      }
      if (puffer.abpfiff === null && letzteWahl) {
        await laden(letzteWahl); // @HT-012: der Klick lädt einen nicht geladenen Abpfiff-Ton neu
      }
      bewerten();
      return berechne() !== 'not_activated';
    },
    laden,
    planen,
    abbrechen,
    jetztSpielen(art) {
      jetztZaehler += 1;
      return planen(`jetzt-${jetztZaehler}`, art, kontext().currentTime);
    },
    audioZeitFuerServerZeit(serverMs, serverNowMs) {
      const k = kontext();
      return k.currentTime + (serverMs - serverNowMs) / 1000 - (k.outputLatency ?? 0);
    },
    lautstaerke: (art) => lautstaerke[art],
    setzeLautstaerke(art, prozent) {
      const wert = Math.round(Math.min(100, Math.max(0, prozent)));
      lautstaerke = { ...lautstaerke, [art]: wert };
      schreib(speicher, LAUTSTAERKE_SCHLUESSEL, JSON.stringify(lautstaerke));
      if (art === 'tor') {
        hymnen.setzeLautstaerke(wert);
      }
      for (const eintrag of geplant.values()) {
        if (eintrag.art === art) {
          eintrag.gain.gain.value = wert / 100;
        }
      }
      bewerten();
    },
    stumm: () => stumm,
    setzeStumm(wert) {
      stumm = wert;
      schreib(speicher, STUMM_SCHLUESSEL, String(wert));
      bewerten();
    },
    zustand: berechne,
    onZustand(fn) {
      zuhoerer.add(fn);
      return () => zuhoerer.delete(fn);
    },
    geplant: () => [...geplant.keys()],
    audioKontext: kontext,
    hymnen,
  };
}

async function holeDaten(url: string): Promise<ArrayBuffer> {
  const antwort = await fetch(url);
  if (!antwort.ok) {
    throw new Error(`Ton nicht ladbar (${antwort.status})`);
  }
  return antwort.arrayBuffer();
}

/** Spieler mit echtem `AudioContext`, `fetch` und `localStorage` (Browser). */
export function erzeugeBrowserHallTonSpieler(): HallTonSpieler {
  const erzeugeKontext = (): AudioKontext => new AudioContext();
  return erzeugeHallTonSpieler({ erzeugeKontext, ladeDaten: holeDaten, speicher: browserSpeicher() });
}
