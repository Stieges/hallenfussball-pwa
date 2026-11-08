/**
 * Zustand der Lautsprecher-Laufzeit (H3b-2b): Typen des Schnappschusses und reine Helfer – Zustand des Geräts und je Feld,
 * nächster Ton, Freigabe je Feld. Reihenfolge der Gründe (Ableitung, Bericht H3b-2b): `slept` vor `not_activated` (@HT-037:
 * bis „Ton aktivieren“), dann `background`, `volume_zero`, `keineVerbindung` (nur dieses Feld), `custom_sound_failed`.
 */
import { ANTWORT_MAX_ALTER_MS, type FeldStand, type GeplanterTon, type HallTonArt } from '../../../core/hallenton';
import type { HallSpeakerState } from '../../../core/repositories/hallentonRpc';
import { feldKennung } from './aktuellesSpielJeFeld';
import type { FeldStandVerfuegbarkeit } from './feldStand';
import { istAngepfiffen } from './feldStandSpiele';
import type { HallTonSpieler, SpielerZustand, TonArt, TonWahl } from './hallTonSpieler';
import type { FeldStandQuelle } from './feldStand';
import type { GeraeteSperre } from './geraeteSperre';
import { MELDUNG_ERNEUERN_MS, type KanalSpeicher, type LautsprecherKanal } from './lautsprecherKanal';
import type { TaktQuelle } from './taktQuelle';
import type { UhrProbe } from '../../../core/hallenton';

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

export interface HallLautsprecherLaufzeit {
  start(): void;
  stop(): void;
  subscribe(fn: () => void): () => void;
  getSnapshot(): LaufzeitSnapshot;
  /** Aus der Nutzergeste „Ton aktivieren“ (@HT-012). */
  tonAktivieren(): Promise<boolean>;
  angehaltenBestaetigen(): void;
  /**
   * „Anhören“ (@HT-023, W2-neu-1): die Töne mit der aktuellen Tonwahl laden, ohne den Tab zu aktivieren – er bekommt dadurch
   * weder die Sperre noch das Recht zu tönen.
   */
  ladeToeneZumAnhoeren(): Promise<void>;
  /**
   * Tonwahl des Turniers (Abpfiff aus `matchCockpitSettings.soundId`, Halbzeit/eigene Töne aus `hall_sound_status`). Eine
   * gleiche Wahl ändert nichts; eine neue lädt der tönende Tab erst, wenn kein Ton bevorsteht oder klingt (k-neu-2, H3b-3).
   */
  setzeTonWahl(wahl: Record<TonArt, TonWahl>): void;
  /** Nach jedem Takt des tönenden Tabs (Worker, 250 ms) – für das Lebenszeichen (H3b-3). */
  beimTakt(fn: () => void): () => void;
  /** Still abschalten (Turnierende aus dem Lebenszeichen, H3b-3): wie Gast und Turnierende, Rolle `still`. */
  stillAbschalten(): void;
}

export interface LaufzeitDeps {
  turnierId: string;
  felder: readonly number[];
  erzeugeTakt: () => TaktQuelle;
  spieler: HallTonSpieler;
  erzeugeFeldStand: () => FeldStandQuelle;
  uhr: { serverNow(): number; sync(): Promise<unknown> };
  uhrProbe: () => UhrProbe;
  sperre: GeraeteSperre;
  kanal: LautsprecherKanal;
  /** `document.wasDiscarded` beim Laden (@HT-037). */
  wurdeVerworfen: boolean;
  tonWahl?: Record<TonArt, TonWahl>;
  /** `localStorage` für das geteilte Gedächtnis (W2); `null` = nur in dieser Laufzeit. */
  gedaechtnisSpeicher?: KanalSpeicher | null;
  /** Einmal, sobald dieser Tab aktiviert ist (Tonwahl lesen, k-neu-3). */
  beimAktivieren?: () => void;
  /** Tonwahl des Turniers lesen (k4-neu-2: „Anhören“ vor der Aktivierung spielt die Hupe des Turniers). */
  leseTonWahl?: () => Promise<Record<TonArt, TonWahl>>;
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

/** Freigabe eines Felds für einen Ton zu `at`: eigenes Cockpit immer, sonst die Antwort dieses Felds nicht vor `at − 3 s`. */
export function feldFrei(feldId: string, at: number, staende: readonly FeldStand[], staendeUm: number): boolean {
  const stand = staende.find((s) => s.feldId === feldId);
  if (!stand) {
    return false;
  }
  return stand.quelle.art === 'eigenesCockpit' || staendeUm - stand.quelle.antwortAlterMs >= at - ANTWORT_MAX_ALTER_MS;
}

/**
 * Freigabe vor dem Ton (@HT-011 ↔ @HT-029) je Feld (`quelle.antwortAlterMs` zum Zeitpunkt `staendeUm`). Ein Ton für mehrere
 * Felder ist frei, wenn eines seiner Felder frei ist (die übrigen Felder tönen, @HT-032).
 */
export function tonFrei(ton: GeplanterTon, staende: readonly FeldStand[], staendeUm: number): boolean {
  return ton.felder.some((feldId) => feldFrei(feldId, ton.at, staende, staendeUm));
}

/**
 * k3: Nach dem Abspielen gelten nur die Enden der freien Felder als erledigt; ein Feld ohne frische Antwort könnte in Wahrheit
 * angehalten sein, sein echtes Ende tönt dann später. Ohne freies Feld (Ton trotz Aussetzer, Restrisiko) alle.
 */
export function nurFreieEnden(ton: GeplanterTon, staende: readonly FeldStand[], staendeUm: number): GeplanterTon {
  const freie = ton.felder.filter((feldId) => feldFrei(feldId, ton.at, staende, staendeUm));
  return freie.length === 0 ? ton : { ...ton, enden: ton.enden.filter((e) => freie.includes(e.feldId)) };
}

/** Warnung „keine Verbindung“ nur für ein angepfiffenes Feld oder nach einem gescheiterten Versuch (Ruling N-2, 2b). */
export function warnFelderAus(warnungen: readonly { feldId: string }[], staende: readonly FeldStand[], gescheitert: boolean): Set<string> {
  const angepfiffen = (feldId: string): boolean => istAngepfiffen(staende.find((s) => s.feldId === feldId)?.state.status);
  return new Set(warnungen.filter((w) => gescheitert || angepfiffen(w.feldId)).map((w) => w.feldId));
}

/**
 * Lautsprecher-Felder an die Tabs melden (Regel 3, Reload-Tor): bei jeder Änderung, sonst höchstens einmal je Sekunde erneuert
 * (W-neu-1). Das Alter misst die Uhr des Kanals (k3-neu-1); ein negatives Alter (Uhr zurückgesprungen) erneuert ebenfalls
 * (k4-neu-1), sonst veraltete die Meldung für die Lesenden. Rückgabe: der gemeldete Inhalt (für den nächsten Vergleich).
 */
export function meldeFelderAnTabs(
  kanal: Pick<LautsprecherKanal, 'melden' | 'eigenesAlter'>,
  turnierId: string,
  felder: readonly number[],
  zustandJeFeld: Readonly<Record<string, FeldZustand>>,
  zuletzt: string | null,
): string {
  const liste = felder.map((feld) => ({ feld, bereit: BEREIT.has(zustandJeFeld[feldKennung(feld)]) }));
  const text = JSON.stringify(liste);
  const alter = kanal.eigenesAlter();
  if (zuletzt !== text || alter === null || alter < 0 || alter >= MELDUNG_ERNEUERN_MS) {
    kanal.melden({ turnierId, felder: liste });
  }
  return text;
}
