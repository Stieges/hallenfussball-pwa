/**
 * Takt der Lautsprecher-Laufzeit (aus `HallLautsprecherLaufzeit.ts`, H4-1): Worker-Takt (250 ms), Weckruf, Freigabe je Feld,
 * Uhrsprung, Plan und Töne des tönenden Tabs.
 *
 * - `bestaetigen` → Uhrsprung → synchron `staende()` und `planeHallToene` mit dem Gedächtnis → Freigabe. Die Netzrunde
 *   `feldStand.aktualisieren(serverNow, letzterPlan.abfrageTaktMs)` wird nur angestoßen, nie abgewartet; läuft sie noch, startet
 *   keine zweite (das Alter der Antwort wächst in jedem Takt weiter). `hallTonGespielt` erst nach dem tatsächlichen Beginn;
 *   das Gedächtnis teilen die Tabs je Turnier (W2).
 * - Regel 2: nur der Stand am Server. Freigabe je Feld (@HT-011 ↔ @HT-029): die Antwort **dieses Felds** liegt nicht vor
 *   `at − 5 s`; ein Ton für mehrere Felder ist frei, wenn eines frei ist.
 * - Uhrsprung (`uhrsprungMs`): erst bestätigen (mit der Zeit vor dem Sprung), dann alles noch nicht Begonnene abbrechen,
 *   `sync()`, danach neu planen (@HT-010, W1).
 */
import {
  LEERES_GEDAECHTNIS, hallTonGespielt, planeHallToene,
  type FeldStand, type GeplanterTon, type PlanErgebnis, type TonGedaechtnis,
} from '../../../core/hallenton';
import type { FeldStandQuelle } from './feldStand';
import { teileGedaechtnis, vereineGedaechtnis } from './geteiltesGedaechtnis';
import { erzeugeUhrsprungWache } from './uhrsprungWache';
import type { TaktQuelle } from './taktQuelle';
import { nurFreieEnden, tonFrei, warnFelderAus, type LaufzeitDeps, type LaufzeitRolle } from './laufzeitZustand';
import type { TonWahlHalter } from './tonWahlWechsel';
import { erzeugeTonSteuerung, type TonSteuerung } from './tonSteuerung';
import type { TorhymnenSteuerung } from './torhymnenSteuerung';

/** Lebender Zustand des Takts; die Fassade liest daraus den Schnappschuss. */
export interface TaktZustand {
  toene: TonSteuerung | null;
  fs: FeldStandQuelle | null;
  staende: FeldStand[];
  staendeUm: number;
  warnFelder: Set<string>;
  ausgesetzt: boolean;
  taktFehler: boolean;
  warAngehalten: boolean;
}

export interface LaufzeitTaktDeps {
  deps: LaufzeitDeps;
  rolle: () => LaufzeitRolle;
  /** Verfügbarkeit weg (Gast, Turnierende): still abschalten. */
  abschalten: (neueRolle: LaufzeitRolle) => void;
  melden: () => void;
  wahl: TonWahlHalter;
  tor: Pick<TorhymnenSteuerung, 'imTakt' | 'abschalten'>;
}

export interface LaufzeitTakt {
  readonly z: TaktZustand;
  /** Nur der Takt- und Ton-Teil von „beginnen“ (die Rolle `toent` setzt die Fassade vorher). */
  beginnen(): void;
  /** Töne abbrechen, Hymne aus, Takt anhalten (die Sperre gibt die Fassade ab). */
  beenden(): void;
  beimTakt(fn: () => void): () => void;
}

export function erzeugeLaufzeitTakt({ deps, rolle, abschalten, melden, wahl, tor }: LaufzeitTaktDeps): LaufzeitTakt {
  const { spieler, uhr } = deps;
  const taktAufraeumen: Array<() => void> = [];
  const taktZuhoerer = new Set<() => void>();
  const speicher = deps.gedaechtnisSpeicher ?? null;
  const wache = erzeugeUhrsprungWache(deps.uhrProbe, uhr);
  const z: TaktZustand = {
    toene: null, fs: null, staende: [], staendeUm: 0, warnFelder: new Set<string>(), ausgesetzt: false, taktFehler: false, warAngehalten: false,
  };
  let takt: TaktQuelle | null = null;
  let gedaechtnis: TonGedaechtnis = LEERES_GEDAECHTNIS;
  let letzterPlan: PlanErgebnis | null = null;
  let runde: Promise<void> | null = null;

  const frei = (ton: GeplanterTon): boolean => tonFrei(ton, z.staende, z.staendeUm);

  function bestaetigen(now: number): void {
    for (const { ton, at } of z.toene?.bestaetigen(now) ?? []) {
      wahl.begonnen(at);
      gedaechtnis = hallTonGespielt(gedaechtnis, nurFreieEnden(ton, z.staende, z.staendeUm), at);
      teileGedaechtnis(speicher, deps.turnierId, gedaechtnis, at);
    }
  }

  /** Synchron in jedem Takt: Stand am Server mit Antwort-Alter → Plan → Ton-Steuerung. */
  function planeJetzt(quelle: FeldStandQuelle, jetzt: number): void {
    const verfuegbar = quelle.verfuegbarkeit();
    if (verfuegbar === 'nichtVerfuegbar' || verfuegbar === 'turnierBeendet') {
      abschalten('still');
      return;
    }
    z.staende = quelle.staende();
    z.staendeUm = jetzt;
    const plan = planeHallToene({ felder: z.staende, serverNow: jetzt }, gedaechtnis);
    gedaechtnis = plan.gedaechtnis;
    letzterPlan = plan;
    z.toene?.uebernehmen(plan.toene, jetzt, frei);
    tor.imTakt(z.staende, jetzt); // nach den End-Tönen: ein gerade geplanter Ton beendet die Hymne zu seinem Beginn
    z.warnFelder = warnFelderAus(plan.warnungen, z.staende, quelle.letzterVersuchGescheitert());
  }

  function imTakt(): void {
    const quelle = z.fs;
    if (rolle() !== 'toent' || !quelle) {
      return;
    }
    const sprung = wache.messen();
    // W1: mit der Zeit vor dem Sprung bestätigen, damit ein begonnener Ton gespielt bleibt und kein künftiger als gespielt gilt
    const now = uhr.serverNow() - (sprung ?? 0);
    bestaetigen(now);
    if (sprung !== null) {
      z.toene?.allesAbbrechen(now);
      wache.abgleichen();
    }
    if (runde === null && !wache.syncLaeuft()) {
      runde = quelle.aktualisieren(now, letzterPlan?.abfrageTaktMs ?? null).catch(() => undefined).finally(() => {
        runde = null;
      });
    }
    if (!wache.syncLaeuft()) {
      planeJetzt(quelle, now);
    }
    z.toene?.pruefen(now, frei);
    wahl.imTakt(z.toene?.naechster() ?? null, now);
    melden();
    for (const fn of [...taktZuhoerer]) {
      fn();
    }
  }

  return {
    z,
    beginnen() {
      const neuerTakt = deps.erzeugeTakt();
      takt = neuerTakt;
      z.toene = erzeugeTonSteuerung({ takt: neuerTakt, spieler });
      z.fs ??= deps.erzeugeFeldStand();
      taktAufraeumen.push(
        neuerTakt.onTakt(imTakt),
        neuerTakt.onWeckruf((id) => z.toene?.weckruf(id, uhr.serverNow(), frei)),
        neuerTakt.onAussetzer((ereignis) => {
          z.ausgesetzt = ereignis.art === 'beginn';
          z.warAngehalten ||= ereignis.art === 'ende';
          melden();
        }),
        neuerTakt.onFehler(() => {
          z.taktFehler = true;
          melden();
        }),
      );
      neuerTakt.start();
      z.taktFehler = neuerTakt.zustand() === 'fehler';
      gedaechtnis = vereineGedaechtnis(speicher, deps.turnierId, gedaechtnis, uhr.serverNow());
    },
    beenden() {
      z.toene?.allesAbbrechen(uhr.serverNow(), true);
      tor.abschalten();
      for (const fn of taktAufraeumen.splice(0)) {
        fn();
      }
      takt?.stop();
      takt = null;
      z.toene = null;
    },
    beimTakt(fn) {
      taktZuhoerer.add(fn);
      return () => {
        taktZuhoerer.delete(fn);
      };
    },
  };
}
