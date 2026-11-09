/**
 * „Anhören“ der Hupen als eigene Art (H4-1, H3c-Befund 4; @HT-023, @HT-017): Die Vorschau gehört nicht zu den geplanten Tönen des
 * Spielers. Sie zählt weder für die Torhymne (`andereToene`) noch als „läuft“; jede echte Ausgabe (Torhymne, End-Ton, Testton)
 * beendet sie zu ihrem Beginn, und sie wird nie gespielt, solange ein echter Ton klingt (Ergebnis `'belegt'`).
 * Alle Zeiten Audiozeit (s).
 */
import type { TonArt } from './tonEinstellungen';
import type { AudioKontext, AudioPuffer, GainKnoten, KompressorKnoten, QuellKnoten } from './webAudioTypen';

/** `true` = gespielt, `false` = nicht spielbar (stumm, 0 %, nicht geladen), `'belegt'` = ein echter Ton klingt gerade. */
export type AnhoerenErgebnis = boolean | 'belegt';

export interface HupenVorschau {
  /** Sofort spielen (höchstens `maxSek` lang); eine laufende Vorschau wird ersetzt. */
  spielen(art: TonArt, ton: AudioPuffer, prozent: number, maxSek: number): void;
  /** Ein echter Ton beginnt bei `wann`: die Vorschau endet spätestens dann (liegt `wann` in der Vergangenheit: sofort). */
  beendenUm(wann: number): void;
  beenden(): void;
  /** Der Regler der Art `art` wurde bewegt: gilt für eine laufende Vorschau dieser Art. */
  setzeLautstaerke(art: TonArt, prozent: number): void;
}

/** `endeAt`: natürliches Ende (Datei, höchstens `maxSek`). */
interface Laufend { art: TonArt; quelle: QuellKnoten; gain: GainKnoten; endeAt: number }

export function erzeugeHupenVorschau(d: { kontext: () => AudioKontext; begrenzer: () => KompressorKnoten }): HupenVorschau {
  let laufend: Laufend | null = null;

  const stopUm = (eintrag: Laufend, wann: number): void => {
    try {
      eintrag.quelle.stop(wann);
    } catch {
      // schon beendet
    }
  };

  return {
    spielen(art, ton, prozent, maxSek) {
      this.beenden();
      const k = d.kontext();
      const quelle = k.createBufferSource();
      const gain = k.createGain();
      quelle.buffer = ton;
      gain.gain.value = prozent / 100;
      quelle.connect(gain);
      gain.connect(d.begrenzer());
      const eintrag: Laufend = { art, quelle, gain, endeAt: k.currentTime + Math.min(ton.duration, maxSek) };
      quelle.onended = () => {
        if (laufend === eintrag) {
          laufend = null;
        }
        quelle.disconnect();
        gain.disconnect();
      };
      laufend = eintrag;
      quelle.start(k.currentTime);
      stopUm(eintrag, eintrag.endeAt);
    },
    beendenUm(wann) {
      if (laufend) {
        stopUm(laufend, Math.min(laufend.endeAt, Math.max(wann, d.kontext().currentTime)));
      }
    },
    beenden() {
      if (laufend) {
        stopUm(laufend, d.kontext().currentTime);
        laufend = null;
      }
    },
    setzeLautstaerke(art, prozent) {
      if (laufend?.art === art) {
        laufend.gain.gain.value = prozent / 100;
      }
    },
  };
}
