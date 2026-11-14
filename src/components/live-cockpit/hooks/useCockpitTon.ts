/**
 * useCockpitTon (H4-12, G5, @HT-009, @SL-125, Befund C-TON-TURNIERWEIT): Ton an/aus und Lautstärke des Cockpit-Tons gelten je GERÄT
 * (`localStorage`, Schlüssel `cockpit:ton`), nicht mehr für das ganze Turnier. Schaltet ein Helfer den Ton aus, bleiben alle anderen
 * Geräte unberührt. Die Felder `soundEnabled`/`soundVolume` der Turnier-Einstellungen sind veraltet und werden nicht mehr gelesen.
 *
 * Erstes Öffnen eines Geräts (nichts gespeichert oder unlesbar): Ton an, 100 %. Alle Tabs und Bausteine desselben Geräts teilen den
 * Stand (`storage`-Ereignis, Zuhörer im Modul). Ohne Speicher (privates Fenster, gesperrt) gilt der Wert bis zum Neuladen.
 */
import { useCallback, useSyncExternalStore } from 'react';

export const COCKPIT_TON_SCHLUESSEL = 'cockpit:ton';

export interface CockpitTon {
  an: boolean;
  /** Prozent, 0 bis 100. */
  lautstaerke: number;
}

export const COCKPIT_TON_VORGABE: CockpitTon = { an: true, lautstaerke: 100 };

export interface TonSpeicher {
  getItem(schluessel: string): string | null;
  setItem(schluessel: string, wert: string): void;
}

/** Lesen ohne Wurf: ungültige oder fehlende Teile fallen einzeln auf die Vorgabe zurück. */
export function liesCockpitTon(roh: string | null): CockpitTon {
  let wert: unknown;
  try {
    wert = JSON.parse(roh ?? 'null');
  } catch {
    wert = null;
  }
  const o = wert && typeof wert === 'object' ? (wert as { an?: unknown; lautstaerke?: unknown }) : {};
  const l = o.lautstaerke;
  return {
    an: typeof o.an === 'boolean' ? o.an : COCKPIT_TON_VORGABE.an,
    lautstaerke: typeof l === 'number' && Number.isFinite(l) && l >= 0 && l <= 100 ? l : COCKPIT_TON_VORGABE.lautstaerke,
  };
}

function browserSpeicher(): TonSpeicher | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const zuhoerer = new Set<() => void>();
let imSpeicherNurHier: string | null = null; // gilt bis zum Neuladen, wenn der Speicher gesperrt ist
let zwischen: { roh: string | null; wert: CockpitTon } = { roh: null, wert: COCKPIT_TON_VORGABE };

function leseRoh(): string | null {
  try {
    return browserSpeicher()?.getItem(COCKPIT_TON_SCHLUESSEL) ?? imSpeicherNurHier;
  } catch {
    return imSpeicherNurHier;
  }
}

/** Stabile Identität je Rohwert (`useSyncExternalStore` verlangt das). */
function momentaufnahme(): CockpitTon {
  const roh = leseRoh();
  if (roh !== zwischen.roh) {
    zwischen = { roh, wert: liesCockpitTon(roh) };
  }
  return zwischen.wert;
}

function melden(): void {
  for (const fn of [...zuhoerer]) {
    fn();
  }
}

function abonniere(fn: () => void): () => void {
  zuhoerer.add(fn);
  const beiSpeicher = (e: StorageEvent): void => {
    if (e.key === COCKPIT_TON_SCHLUESSEL || e.key === null) {
      fn();
    }
  };
  window.addEventListener('storage', beiSpeicher);
  return () => {
    zuhoerer.delete(fn);
    window.removeEventListener('storage', beiSpeicher);
  };
}

export function schreibeCockpitTon(neu: CockpitTon): void {
  const roh = JSON.stringify(neu);
  imSpeicherNurHier = null;
  try {
    const speicher = browserSpeicher();
    if (speicher === null) {
      imSpeicherNurHier = roh;
    } else {
      speicher.setItem(COCKPIT_TON_SCHLUESSEL, roh);
    }
  } catch {
    imSpeicherNurHier = roh; // gesperrt oder voll: gilt bis zum Neuladen
  }
  melden();
}

export interface CockpitTonSteuerung extends CockpitTon {
  setAn: (an: boolean) => void;
  setLautstaerke: (prozent: number) => void;
}

export function useCockpitTon(): CockpitTonSteuerung {
  const ton = useSyncExternalStore(abonniere, momentaufnahme, () => COCKPIT_TON_VORGABE);
  const setAn = useCallback((an: boolean) => { schreibeCockpitTon({ ...momentaufnahme(), an }); }, []);
  const setLautstaerke = useCallback((prozent: number) => {
    schreibeCockpitTon({ ...momentaufnahme(), lautstaerke: Math.min(100, Math.max(0, Math.round(prozent))) });
  }, []);
  return { ...ton, setAn, setLautstaerke };
}

/** Nur für Tests: den Zwischenspeicher des Moduls vergessen. */
export function __setzeCockpitTonFuerTests(): void {
  imSpeicherNurHier = null;
  zwischen = { roh: null, wert: COCKPIT_TON_VORGABE };
}
