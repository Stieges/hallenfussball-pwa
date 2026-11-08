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
import { MELDUNG_ERNEUERN_MS, type KanalSpeicher, type LautsprecherFeldMeldung, type LautsprecherKanal } from './lautsprecherKanal';
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

/** Serverzeit der letzten Antwort für das Feld (`staendeUm − antwortAlterMs`); `null` ohne Stand oder ohne Antwort. */
export function antwortAtVon(feldId: string, staende: readonly FeldStand[], staendeUm: number): number | null {
  const stand = staende.find((s) => s.feldId === feldId);
  return stand && Number.isFinite(stand.antwortAlterMs) ? staendeUm - stand.antwortAlterMs : null;
}

/**
 * Freigabe eines Felds für einen Ton (Regel 2, @HT-011): die Antwort dieses Felds liegt nicht vor `ton.antwortNoetigAb`
 * (`at − 5 s`, vom Planer gesetzt – eine Grenze, eine Stelle; K-3 aus dem Review von H3b-4).
 */
export function feldFrei(feldId: string, ton: GeplanterTon, staende: readonly FeldStand[], staendeUm: number): boolean {
  const antwortAt = antwortAtVon(feldId, staende, staendeUm);
  return antwortAt !== null && antwortAt >= ton.antwortNoetigAb;
}

/**
 * Freigabe vor dem Ton (@HT-011 ↔ @HT-029) je Feld (`antwortAlterMs` zum Zeitpunkt `staendeUm`). Ein Ton für mehrere
 * Felder ist frei, wenn eines seiner Felder frei ist (die übrigen Felder tönen, @HT-032).
 */
export function tonFrei(ton: GeplanterTon, staende: readonly FeldStand[], staendeUm: number): boolean {
  return ton.felder.some((feldId) => feldFrei(feldId, ton, staende, staendeUm));
}

/**
 * k3: Nach dem Abspielen gelten nur die Enden der freien Felder als erledigt; ein Feld ohne frische Antwort könnte in Wahrheit
 * angehalten sein, sein echtes Ende tönt dann später. Ohne freies Feld (Ton trotz Aussetzer, Restrisiko) alle.
 */
export function nurFreieEnden(ton: GeplanterTon, staende: readonly FeldStand[], staendeUm: number): GeplanterTon {
  const freie = ton.felder.filter((feldId) => feldFrei(feldId, ton, staende, staendeUm));
  return freie.length === 0 ? ton : { ...ton, enden: ton.enden.filter((e) => freie.includes(e.feldId)) };
}

/** Warnung „keine Verbindung“ nur für ein angepfiffenes Feld oder nach einem gescheiterten Versuch (Ruling N-2, 2b). */
export function warnFelderAus(warnungen: readonly { feldId: string }[], staende: readonly FeldStand[], gescheitert: boolean): Set<string> {
  const angepfiffen = (feldId: string): boolean => istAngepfiffen(staende.find((s) => s.feldId === feldId)?.state.status);
  return new Set(warnungen.filter((w) => gescheitert || angepfiffen(w.feldId)).map((w) => w.feldId));
}

/** K-2: Eine gemeldete Antwort, die so alt ist, wird sofort ersetzt, sobald eine neuere vorliegt (nach einem Aussetzer). */
const NACH_AUSSETZER_MS = ANTWORT_MAX_ALTER_MS - 1000;

/** Nach einem Aussetzer: die gemeldete Antwort ist mindestens 4 s alt, und eine neuere liegt vor. */
function nachAussetzer(neu: number | null | undefined, alt: number | null | undefined, jetzt: number): boolean {
  return typeof neu === 'number' && typeof alt === 'number' && neu > alt && jetzt - alt >= NACH_AUSSETZER_MS;
}

/**
 * Geändert heißt: anderes Feld, anderes „bereit“, Antwort neu da bzw. weg oder eine neue Antwort nach einem Aussetzer (K-2);
 * sonst trägt die Erneuerung je Sekunde die Zeit der Antwort nach.
 */
function weichtAb(a: readonly LautsprecherFeldMeldung[], b: readonly LautsprecherFeldMeldung[] | null, jetzt: number): boolean {
  if (b?.length !== a.length) {
    return true;
  }
  return a.some((f, i) => f.feld !== b[i].feld || f.bereit !== b[i].bereit || (f.antwortAt === null) !== (b[i].antwortAt === null)
    || nachAussetzer(f.antwortAt, b[i].antwortAt, jetzt));
}

/**
 * Lautsprecher-Felder an die Tabs melden (Regel 3, Reload-Tor): bei jeder Änderung, sonst höchstens einmal je Sekunde erneuert
 * (W-neu-1). Das Alter misst die Uhr des Kanals (k3-neu-1); ein negatives Alter (Uhr zurückgesprungen) erneuert ebenfalls
 * (k4-neu-1), sonst veraltete die Meldung für die Lesenden. Je Feld steht die Serverzeit der letzten Antwort dabei (K3 aus
 * H3b-3): Das Cockpit prüft damit beim Ton-Anlass dieselbe 5-s-Grenze wie die Freigabe (`cockpitTon.ts`). Die Zeit kommt mit
 * der Erneuerung je Sekunde nach (sonst schriebe jede Antwort), nach einem Aussetzer sofort (K-2); ist sie älter als die wahre,
 * tönt das Cockpit im Zweifel mit – nie gar kein Ton. Abgerundet (K-1): die Meldung wirkt eher älter, nie jünger. `jetzt` ist
 * die Serverzeit des Stands. Rückgabe: die zuletzt geschriebenen Felder (für den nächsten Vergleich).
 */
export function meldeFelderAnTabs(
  kanal: Pick<LautsprecherKanal, 'melden' | 'eigenesAlter'>,
  turnierId: string,
  felder: readonly number[],
  zustandJeFeld: Readonly<Record<string, FeldZustand>>,
  antwortAt: (feldId: string) => number | null,
  jetzt: number,
  zuletzt: readonly LautsprecherFeldMeldung[] | null,
): readonly LautsprecherFeldMeldung[] | null {
  const liste = felder.map((feld) => {
    const id = feldKennung(feld);
    const at = antwortAt(id);
    return { feld, bereit: BEREIT.has(zustandJeFeld[id]), antwortAt: at === null ? null : Math.floor(at) };
  });
  const alter = kanal.eigenesAlter();
  if (weichtAb(liste, zuletzt, jetzt) || alter === null || alter < 0 || alter >= MELDUNG_ERNEUERN_MS) {
    kanal.melden({ turnierId, felder: liste });
    return liste;
  }
  return zuletzt;
}
