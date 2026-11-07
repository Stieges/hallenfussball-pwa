/**
 * Zustand der Lautsprecher-Laufzeit (H3b-2b): Typen des Schnappschusses und reine Helfer – Zustand des Geräts und je Feld,
 * nächster Ton, Freigabe je Feld. Reihenfolge der Gründe (Ableitung, Bericht H3b-2b): `slept` vor `not_activated` (@HT-037:
 * bis „Ton aktivieren“), dann `background`, `volume_zero`, `keineVerbindung` (nur dieses Feld), `custom_sound_failed`.
 */
import { ANTWORT_MAX_ALTER_MS, type FeldStand, type GeplanterTon, type HallTonArt } from '../../../core/hallenton';
import type { HallSpeakerState } from '../../../core/repositories/hallentonRpc';
import { feldKennung } from './aktuellesSpielJeFeld';
import type { FeldStandVerfuegbarkeit } from './feldStand';
import type { SpielerZustand } from './hallTonSpieler';

export type FeldZustand = HallSpeakerState | 'keineVerbindung';
/** `aus` vor `start`/nach `stop`, `wartet` auf die Sperre, `andererTab` tönt, `toent` hier, `still` abgeschaltet (Gast, Turnierende). */
export type LaufzeitRolle = 'aus' | 'wartet' | 'andererTab' | 'toent' | 'still';

export interface NaechsterTon {
  at: number;
  art: HallTonArt;
  felder: readonly string[];
  spiele: readonly string[];
}

export interface LaufzeitSnapshot {
  rolle: LaufzeitRolle;
  turnierId: string;
  felder: readonly number[];
  geraeteZustand: HallSpeakerState;
  /** Je `field-N`. */
  zustandJeFeld: Readonly<Record<string, FeldZustand>>;
  naechsterTon: NaechsterTon | null;
  /** Worker nicht erzeugbar oder abgestürzt. */
  taktFehler: boolean;
  /** Der Takt hatte ausgesetzt (@HT-014: „App war angehalten – Töne können gefehlt haben“), bis bestätigt. */
  warAngehalten: boolean;
  verfuegbarkeit: FeldStandVerfuegbarkeit | null;
}

/** „Bereit“ für die anderen Tabs (Regel 3) und das Reload-Tor: die Halle hört den Ton (auch „Hupe 1“ als Rückfall, @HT-028). */
export const BEREIT: ReadonlySet<FeldZustand> = new Set<FeldZustand>(['ready', 'custom_sound_failed']);

export function geraeteZustandAus(lage: { geschlafen: boolean; spieler: SpielerZustand; ausgesetzt: boolean; taktFehler: boolean }): HallSpeakerState {
  if (lage.geschlafen) {
    return 'slept';
  }
  if (lage.spieler === 'not_activated') {
    return 'not_activated';
  }
  return lage.ausgesetzt || lage.taktFehler ? 'background' : lage.spieler;
}

/** Je `field-N`: der Zustand des Geräts; ist es sonst bereit und warnt der Planer für das Feld, `keineVerbindung`. */
export function feldZustaende(geraet: HallSpeakerState, felder: readonly number[], warnFelder: ReadonlySet<string>): Record<string, FeldZustand> {
  const ergebnis: Record<string, FeldZustand> = {};
  for (const feld of felder) {
    const id = feldKennung(feld);
    ergebnis[id] = warnFelder.has(id) && BEREIT.has(geraet) ? 'keineVerbindung' : geraet;
  }
  return ergebnis;
}

export function naechsterTonAus(ton: GeplanterTon | null, staende: readonly FeldStand[]): NaechsterTon | null {
  if (!ton) {
    return null;
  }
  const spielJeFeld = new Map(staende.map((s) => [s.feldId, s.ctx.matchId] as const));
  return { at: ton.at, art: ton.art, felder: ton.felder, spiele: ton.felder.flatMap((f) => spielJeFeld.get(f) ?? []) };
}

/**
 * Freigabe vor dem Ton (@HT-011 ↔ @HT-029) je Feld: frisch ist die Antwort dieses Felds (`quelle.antwortAlterMs` zum Zeitpunkt
 * `staendeUm`), wenn sie nicht vor `at − 3 s` liegt; ein Feld nach eigenem Cockpit ist immer frei. Ein Ton für mehrere Felder
 * ist frei, wenn eines seiner Felder frei ist (die übrigen Felder tönen, @HT-032).
 */
export function tonFrei(ton: GeplanterTon, staende: readonly FeldStand[], staendeUm: number): boolean {
  return ton.felder.some((feldId) => {
    const stand = staende.find((s) => s.feldId === feldId);
    if (!stand) {
      return false;
    }
    return stand.quelle.art === 'eigenesCockpit' || staendeUm - stand.quelle.antwortAlterMs >= ton.at - ANTWORT_MAX_ALTER_MS;
  });
}
