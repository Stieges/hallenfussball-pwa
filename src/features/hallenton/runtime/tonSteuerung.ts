/**
 * Ton-Steuerung der Lautsprecher-Laufzeit (H3b-2b, Einbau-Vertrag des Planers Punkte 2–4): bringt die geplanten Töne eines
 * Plans zum Spieler, genau zu `at`.
 *
 * - Liegt `at` weiter als 3 s voraus, setzt sie einen Weckruf im Worker 3 s vorher; dann (oder sofort, wenn `at` näher liegt)
 *   `spieler.planen(id, art, audioZeit(at))`. Ein neuer Plan ersetzt den alten: weggefallene Töne werden abgebrochen,
 *   ein verschobenes `at` neu geplant.
 * - Freigabe vor dem Ton (@HT-011 ↔ @HT-029): ab 250 ms vor `at` darf ein Ton nur zum Spieler, wenn `frei(ton)` gilt; ein schon
 *   geplanter Ton ohne Freigabe wird abgebrochen (kein Ton nach altem Stand). Setzt der Worker genau in diesen 250 ms aus,
 *   spielt der Ton (Restrisiko laut Plan).
 * - Gespielt ist ein Ton erst, wenn `at` erreicht ist, der Spieler ihn angenommen hat und seine Ausgabe läuft; ein
 *   abgebrochener oder nie angenommener Ton zählt nicht. Ein begonnener Ton wird von einem neuen Plan nie abgebrochen.
 * Alle Zeiten Serverzeit (ms).
 */
import type { GeplanterTon } from '../../../core/hallenton';
import type { HallTonSpieler } from './hallTonSpieler';
import type { TaktQuelle } from './taktQuelle';

/** Weckruf aus dem Worker so lange vor dem Ton (Plan „Freigabe vor dem Ton“). */
export const WECKRUF_VORLAUF_MS = 3000;
/** Ab hier prüft der Takt die Freigabe (250-ms-Takt). */
export const FREIGABE_VOR_MS = 250;

export interface TonSteuerungDeps {
  takt: TaktQuelle;
  spieler: HallTonSpieler;
}

export interface GespielterTon {
  ton: GeplanterTon;
  /** Serverzeit, zu der der Ton begann. */
  at: number;
}

export interface TonSteuerung {
  /** Neuer Plan; `frei` entscheidet die Freigabe je Ton. */
  uebernehmen(toene: readonly GeplanterTon[], now: number, frei: (ton: GeplanterTon) => boolean): void;
  /** Im Takt: Freigabe im 250-ms-Fenster prüfen. */
  pruefen(now: number, frei: (ton: GeplanterTon) => boolean): void;
  weckruf(id: string, now: number, frei: (ton: GeplanterTon) => boolean): void;
  /** Töne, die seit dem letzten Aufruf begonnen haben (für `hallTonGespielt`). */
  bestaetigen(now: number): GespielterTon[];
  /** Alles noch nicht Begonnene abbrechen (Uhrsprung); `auchLaufende` beim Abschalten. */
  allesAbbrechen(auchLaufende?: boolean): void;
  naechster(): GeplanterTon | null;
}

interface Eintrag {
  ton: GeplanterTon;
  /** Serverzeit, zu der der Spieler den Ton angenommen hat; `null` = (noch) nicht beim Spieler. */
  geplantUm: number | null;
  weckAt: number | null;
}

export function tonKennung(ton: GeplanterTon): string {
  return `ton:${[...ton.schluessel].sort().join('+')}`;
}

export function erzeugeTonSteuerung({ takt, spieler }: TonSteuerungDeps): TonSteuerung {
  const eintraege = new Map<string, Eintrag>();

  const begonnen = (eintrag: Eintrag, now: number): boolean => eintrag.geplantUm !== null && eintrag.ton.at <= now;

  const abbrechen = (id: string): void => {
    spieler.abbrechen(id);
    takt.abbrechen(id);
  };

  /** Zum Spieler, wenn der Ton höchstens 3 s voraus liegt (im Freigabe-Fenster nur mit Freigabe); sonst Weckruf. */
  const vorbereiten = (id: string, eintrag: Eintrag, now: number, frei: (ton: GeplanterTon) => boolean): void => {
    const { ton } = eintrag;
    if (ton.at - now > WECKRUF_VORLAUF_MS) {
      if (eintrag.weckAt !== ton.at) {
        eintrag.weckAt = ton.at;
        takt.wecken(id, ton.at - now - WECKRUF_VORLAUF_MS);
      }
      return;
    }
    if (ton.at - now <= FREIGABE_VOR_MS && !frei(ton)) {
      return;
    }
    if (spieler.planen(id, ton.art, spieler.audioZeitFuerServerZeit(ton.at, now))) {
      eintrag.geplantUm = now;
    }
  };

  return {
    uebernehmen(toene, now, frei) {
      const neu = new Map(toene.map((ton) => [tonKennung(ton), ton] as const));
      for (const [id, eintrag] of eintraege) {
        if (!neu.has(id) && !begonnen(eintrag, now)) {
          abbrechen(id);
          eintraege.delete(id);
        }
      }
      for (const [id, ton] of neu) {
        const alt = eintraege.get(id);
        if (alt && begonnen(alt, now)) {
          continue; // ein begonnener Ton bleibt, wie er ist
        }
        if (alt?.ton.at === ton.at && alt.geplantUm !== null) {
          alt.ton = ton;
          continue;
        }
        if (alt !== undefined && alt.geplantUm !== null) {
          spieler.abbrechen(id); // `at` verschoben: neu planen
        }
        const eintrag: Eintrag = { ton, geplantUm: null, weckAt: alt?.ton.at === ton.at ? alt.weckAt : null };
        eintraege.set(id, eintrag);
        vorbereiten(id, eintrag, now, frei);
      }
    },
    pruefen(now, frei) {
      for (const [id, eintrag] of eintraege) {
        const rest = eintrag.ton.at - now;
        if (eintrag.geplantUm !== null && rest > 0 && rest <= FREIGABE_VOR_MS && !frei(eintrag.ton)) {
          spieler.abbrechen(id); // keine frische Antwort für das Feld: kein Ton nach altem Stand
          eintrag.geplantUm = null;
        }
      }
    },
    weckruf(id, now, frei) {
      const eintrag = eintraege.get(id);
      if (eintrag?.geplantUm === null) {
        eintrag.weckAt = eintrag.ton.at; // ein zu früher Weckruf weckt nicht erneut; der nächste Plan holt den Ton nach
        vorbereiten(id, eintrag, now, frei);
      }
    },
    bestaetigen(now) {
      const gespielt: GespielterTon[] = [];
      // Bestätigung des Spielers: er hat den Ton angenommen, niemand hat ihn abgebrochen (nur diese Steuerung bricht ab),
      // und die Ausgabe läuft. Ob er schon wieder zu Ende ist (`geplant()` leer nach `ended`), zählt nicht – ein im
      // Hintergrund verspäteter Takt dürfte ihn sonst als ungespielt neu planen (doppelter Ton).
      const ausgabeLaeuft = spieler.zustand() !== 'not_activated';
      for (const [id, eintrag] of eintraege) {
        if (eintrag.geplantUm !== null && eintrag.ton.at <= now) {
          if (ausgabeLaeuft) {
            gespielt.push({ ton: eintrag.ton, at: Math.max(eintrag.ton.at, eintrag.geplantUm) });
          }
          eintraege.delete(id);
        }
      }
      return gespielt;
    },
    allesAbbrechen(auchLaufende = false) {
      for (const id of [...eintraege.keys()]) {
        abbrechen(id);
        eintraege.delete(id);
      }
      if (!auchLaufende) {
        return;
      }
      for (const id of spieler.geplant()) {
        spieler.abbrechen(id);
      }
    },
    naechster() {
      let erster: GeplanterTon | null = null;
      for (const { ton } of eintraege.values()) {
        if (erster === null || ton.at < erster.at) {
          erster = ton;
        }
      }
      return erster;
    },
  };
}
