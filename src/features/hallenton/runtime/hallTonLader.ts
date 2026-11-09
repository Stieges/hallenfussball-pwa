/**
 * Laden und Dekodieren der Töne des Hallen-Lautsprechers (aus `hallTonSpieler.ts`, H4-1):
 * Hupen `horn-1|2|3` aus `/sounds/horn-N.mp3` (IDs wie `PRESET_SOUNDS` in `useMatchSound`) oder eigener Ton über die öffentliche
 * Storage-Adresse (nur `https:`, kein `blob:`/`data:` – CSP). Immer per `fetch` + `decodeAudioData`.
 * Eigener Ton nicht ladbar oder länger als 5 s → „Hupe 1“ und `custom_sound_failed` (@HT-028 Zeile 4, entscheidet der Spieler).
 */
import type { AudioKontext, AudioPuffer } from './webAudioTypen';
import type { TonArt } from './tonEinstellungen';
import { istHttps } from './torhymnenAusgabe';

export type HupenId = 'horn-1' | 'horn-2' | 'horn-3';
export type TonWahl = HupenId | { eigeneUrl: string };
export type LadeStand = 'geladen' | 'rueckfall' | 'fehlt';

export const HART_STOPP_SEK = 5;
const HUPEN_URL: Record<HupenId, string> = { 'horn-1': '/sounds/horn-1.mp3', 'horn-2': '/sounds/horn-2.mp3', 'horn-3': '/sounds/horn-3.mp3' };
const ARTEN: readonly TonArt[] = ['abpfiff', 'halbzeit'];

/** Ergebnis eines Ladens der Tonwahl: Puffer, „eigener Ton fehlt“ und Stand je Art. */
export interface Geladen {
  puffer: Record<TonArt, AudioPuffer | null>;
  eigenerTonFehlt: Record<TonArt, boolean>;
  stand: Record<TonArt, LadeStand>;
}

export interface HallTonLader {
  dekodiere(url: string): Promise<AudioPuffer | null>;
  ladeWahl(toene: Record<TonArt, TonWahl>): Promise<Geladen>;
}

export interface HallTonLaderDeps {
  kontext: () => AudioKontext;
  ladeDaten: (url: string) => Promise<ArrayBuffer>;
}

export function erzeugeHallTonLader({ kontext, ladeDaten }: HallTonLaderDeps): HallTonLader {
  const hupen = new Map<HupenId, Promise<AudioPuffer | null>>();

  const dekodiere = async (url: string): Promise<AudioPuffer | null> => {
    try {
      return await kontext().decodeAudioData(await ladeDaten(url));
    } catch {
      return null;
    }
  };

  const hupe = (id: HupenId): Promise<AudioPuffer | null> => {
    const vorhanden = hupen.get(id);
    if (vorhanden) {
      return vorhanden;
    }
    const laden = dekodiere(HUPEN_URL[id]).then((p) => {
      if (!p) {
        hupen.delete(id); // beim nächsten Laden erneut versuchen
      }
      return p;
    });
    hupen.set(id, laden);
    return laden;
  };

  const eigenerTon = async (url: string): Promise<AudioPuffer | null> => {
    if (!istHttps(url)) {
      return null;
    }
    const p = await dekodiere(url);
    return p && p.duration <= HART_STOPP_SEK ? p : null;
  };

  return {
    dekodiere,
    async ladeWahl(toene) {
      const rueckfall = await hupe('horn-1');
      const puffer: Record<TonArt, AudioPuffer | null> = { abpfiff: null, halbzeit: null };
      const eigenerTonFehlt: Record<TonArt, boolean> = { abpfiff: false, halbzeit: false };
      const stand: Record<TonArt, LadeStand> = { abpfiff: 'fehlt', halbzeit: 'fehlt' };
      for (const art of ARTEN) {
        const wahl = toene[art];
        const geladen = typeof wahl === 'string' ? await hupe(wahl) : await eigenerTon(wahl.eigeneUrl);
        if (geladen) {
          puffer[art] = geladen;
          stand[art] = 'geladen';
        } else if (typeof wahl !== 'string') {
          eigenerTonFehlt[art] = true;
          puffer[art] = rueckfall;
          stand[art] = rueckfall ? 'rueckfall' : 'fehlt';
        }
      }
      return { puffer, eigenerTonFehlt, stand };
    },
  };
}
