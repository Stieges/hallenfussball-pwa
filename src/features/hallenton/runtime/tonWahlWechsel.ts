/**
 * Tonwahl der Lautsprecher-Laufzeit und ihr Wechsel während des Turniers (H3b-3, k-neu-2 und k4-neu-2 aus H3b-2b, @HT-025,
 * @HT-027). Das Lebenszeichen liest die Wahl neu (`setzen`); eine gleiche Wahl ändert nichts. Eine geänderte Wahl lädt
 * der tönende Tab erst, wenn es ruhig ist:
 * - kein Ton in den nächsten 3 s (Weckruf-Vorlauf: ein Ton, der schon beim Spieler liegt oder gleich dorthin geht, bleibt
 *   bei der alten Wahl – „Ändert sich die Wahl weniger als 3 s vor einem Ton, gilt für diesen Ton noch die alte Wahl“),
 * - und der zuletzt begonnene Ton ist vorbei (harter Stopp nach 5 s: geplante Töne behalten ihren Puffer bis zum Ende).
 * Ein nicht aktivierter Tab merkt sich die Wahl nur (k-neu-3); „Anhören“ vor der Aktivierung liest sie vorher (k4-neu-2).
 */
import type { GeplanterTon } from '../../../core/hallenton';
import { HART_STOPP_SEK, type HallTonSpieler, type TonArt, type TonWahl } from './hallTonSpieler';
import { WECKRUF_VORLAUF_MS } from './tonSteuerung';

export type TonWahlSatz = Record<TonArt, TonWahl>;

export function gleicheTonWahl(a: TonWahlSatz, b: TonWahlSatz): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function ruhigFuerTonWahl(naechster: GeplanterTon | null, letzterBeginn: number | null, now: number): boolean {
  const keinerBald = naechster === null || naechster.at - now > WECKRUF_VORLAUF_MS;
  const keinerKlingt = letzterBeginn === null || now - letzterBeginn >= HART_STOPP_SEK * 1000;
  return keinerBald && keinerKlingt;
}

/** `nichtAktiviert`: nur merken; `toent`: sofort laden, wenn es ruhig ist, sonst im ersten ruhigen Takt; `aktiviert`: sofort. */
export type TonWahlLage = 'nichtAktiviert' | 'toent' | 'aktiviert';

export interface TonWahlHalter {
  wahl(): TonWahlSatz;
  /** `naechster`/`now`: der nächste geplante Ton und die Serverzeit (für `toent`). */
  setzen(wahl: TonWahlSatz, lage: TonWahlLage, naechster: GeplanterTon | null, now: number): void;
  /** Ein Ton hat begonnen (Serverzeit). */
  begonnen(at: number): void;
  /** Im Takt des tönenden Tabs: eine zurückgestellte Wahl laden, sobald es ruhig ist. */
  imTakt(naechster: GeplanterTon | null, now: number): void;
  /** „Anhören“ in einem nicht aktivierten Tab: die Wahl des Turniers lesen und laden (`aktiviert`: schon geladen). */
  zumAnhoeren(aktiviert: () => boolean): Promise<void>;
}

export interface TonWahlHalterDeps {
  spieler: Pick<HallTonSpieler, 'laden'>;
  start: TonWahlSatz;
  lesen?: () => Promise<TonWahlSatz>;
  /** Nach jedem Laden (Zustand neu melden). */
  geladen: () => void;
}

export function erzeugeTonWahlHalter({ spieler, start, lesen, geladen }: TonWahlHalterDeps): TonWahlHalter {
  let aktuell = start;
  let neu: TonWahlSatz | null = null;
  let letzterBeginn: number | null = null;

  const laden = (wahl: TonWahlSatz): void => {
    aktuell = wahl;
    neu = null;
    void spieler.laden(wahl).then(geladen, geladen);
  };

  return {
    wahl: () => aktuell,
    setzen(wahl, lage, naechster, now) {
      if (gleicheTonWahl(wahl, neu ?? aktuell)) {
        return;
      }
      if (lage === 'nichtAktiviert') {
        aktuell = wahl;
        neu = null;
      } else if (lage === 'toent' && !ruhigFuerTonWahl(naechster, letzterBeginn, now)) {
        neu = wahl;
      } else {
        laden(wahl);
      }
    },
    begonnen(at) {
      letzterBeginn = Math.max(letzterBeginn ?? at, at);
    },
    imTakt(naechster, now) {
      if (neu && ruhigFuerTonWahl(naechster, letzterBeginn, now)) {
        laden(neu);
      }
    },
    async zumAnhoeren(aktiviert) {
      if (aktiviert()) {
        return;
      }
      const gelesen = lesen ? await lesen().catch(() => null) : null;
      if (gelesen && !aktiviert()) {
        aktuell = gelesen;
        neu = null;
      }
      await spieler.laden(aktuell);
    },
  };
}
