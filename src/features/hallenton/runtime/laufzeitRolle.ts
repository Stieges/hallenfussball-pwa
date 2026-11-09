/**
 * Rolle, Aktivierung und Sperre der Lautsprecher-Laufzeit (aus `HallLautsprecherLaufzeit.ts`, H4-1):
 * - Sperre je Gerät (@HT-033 Zeile 8): Ein Tab fordert sie erst an, wenn sein Spieler aktiviert ist (Ruling W3); bis dahin
 *   `wartet` er ohne Last (k-neu-3). Fällt die Ausgabe des Halters auf `not_activated`, gibt er sie frei (k-neu-4).
 * - Erst mit der Sperre (`erhalten`) beginnt der Takt (`beginne`, von der Fassade übergeben).
 */
import type { GeraeteSperre } from './geraeteSperre';
import type { HallTonSpieler } from './hallTonSpieler';
import type { LaufzeitRolle } from './laufzeitZustand';
import type { TorhymnenSteuerung } from './torhymnenSteuerung';

export interface RollenHalterDeps {
  spieler: Pick<HallTonSpieler, 'zustand'>;
  sperre: GeraeteSperre;
  tor: Pick<TorhymnenSteuerung, 'aktiviert'>;
  /** Die Sperre ist erteilt: Takt und Feldstand starten. */
  beginne: () => void;
  /** Sperre und Takt abgeben (die Fassade ruft danach `sperreFreigeben`). */
  loslassen: (neueRolle: LaufzeitRolle) => void;
  melden: () => void;
  /** Einmal, sobald dieser Tab aktiviert ist (Tonwahl lesen, k-neu-3). */
  beimAktivieren?: () => void;
}

export interface RollenHalter {
  rolle(): LaufzeitRolle;
  setze(neueRolle: LaufzeitRolle): void;
  aktiviert(): boolean;
  /** k-neu-3: Töne und Tonwahl erst für einen aktivierten Tab. */
  wirdAktiviert(): void;
  /** W3: die Sperre erst, wenn der Spieler dieses Tabs aktiviert ist (sonst landete sie in einem stummen Tab). */
  pruefeSperre(): void;
  beiSpielerZustand(): void;
  /** Die gehaltene Sperre abgeben; eine neue kann danach angefordert werden. */
  sperreFreigeben(): void;
}

export function erzeugeRollenHalter(d: RollenHalterDeps): RollenHalter {
  const { spieler } = d;
  let rolle: LaufzeitRolle = 'aus';
  let freigeben: (() => void) | null = null;
  let sperreAngefordert = false;
  let aktiviert = false;

  function pruefeSperre(): void {
    if (rolle !== 'wartet' || sperreAngefordert || !aktiviert || spieler.zustand() === 'not_activated') {
      return;
    }
    sperreAngefordert = true;
    const loesen = d.sperre.anfordern((meldung) => {
      if (rolle !== 'wartet' && rolle !== 'andererTab') {
        return;
      }
      if (meldung === 'erhalten') {
        d.beginne();
      } else {
        rolle = 'andererTab';
        d.melden();
      }
    });
    freigeben ??= loesen;
  }

  return {
    rolle: () => rolle,
    setze(neueRolle) {
      rolle = neueRolle;
    },
    aktiviert: () => aktiviert,
    wirdAktiviert() {
      if (aktiviert) {
        return;
      }
      aktiviert = true;
      d.tor.aktiviert();
      d.beimAktivieren?.();
    },
    pruefeSperre,
    beiSpielerZustand() {
      if ((rolle === 'toent' || rolle === 'andererTab') && spieler.zustand() === 'not_activated') {
        d.loslassen('wartet'); // k-neu-4: eine stehende Ausgabe hält die Sperre nicht fest
      }
      pruefeSperre();
      d.melden();
    },
    sperreFreigeben() {
      freigeben?.();
      freigeben = null;
      sperreAngefordert = false;
    },
  };
}
