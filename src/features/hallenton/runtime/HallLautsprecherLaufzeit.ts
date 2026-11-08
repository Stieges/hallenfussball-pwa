/**
 * Tonlaufzeit des Hallen-Lautsprechers (H3b-2b, Plan „H3b – Einbau“, Einbau-Vertrag des Planers): Zustandsspeicher ohne
 * React (`subscribe`/`getSnapshot`), alle Abhängigkeiten injiziert.
 *
 * - Sperre je Gerät (@HT-033 Zeile 8): Ein Tab fordert sie erst an, wenn sein Spieler aktiviert ist (Ruling W3); bis dahin
 *   `wartet` er ohne Last – keine Töne laden, keine Abfrage (k-neu-3). Fällt die Ausgabe des Halters auf `not_activated`,
 *   gibt er die Sperre frei (k-neu-4). Erst mit der Sperre entstehen Worker-Takt und Feldstand.
 * - Takt (250 ms aus dem Worker): `bestaetigen` → Uhrsprung → synchron `staende()` und `planeHallToene` mit dem Gedächtnis →
 *   Freigabe. Die Netzrunde `feldStand.aktualisieren(serverNow, letzterPlan.abfrageTaktMs)` wird nur angestoßen, nie
 *   abgewartet; läuft sie noch, startet keine zweite (das Alter der Antwort wächst in jedem Takt weiter).
 *   `hallTonGespielt` erst nach dem tatsächlichen Beginn; das Gedächtnis teilen die Tabs je Turnier (W2).
 * - Regel 2 („Hupe und Anzeige sagen dasselbe“, 07.11.): nur der Stand am Server, auch wenn das Gerät das Feld selbst leitet.
 *   Freigabe je Feld (@HT-011 ↔ @HT-029): frisch heißt, die Antwort **dieses Felds** (`antwortAlterMs`) liegt nicht vor
 *   `at − 5 s`; ein Ton für mehrere Felder ist frei, wenn eines frei ist.
 * - Uhrsprung (`uhrsprungMs`): erst bestätigen (mit der Zeit vor dem Sprung), dann alles noch nicht Begonnene abbrechen,
 *   `sync()`, danach neu planen (@HT-010, W1).
 * - Zustand je Feld: `slept` (bis „Ton aktivieren“, @HT-037), `not_activated` (@HT-012/013), `background` (Takt setzt länger
 *   als 3 s aus oder Worker gescheitert, nie bloßes Verdecken, @HT-014), `volume_zero`, `keineVerbindung` (Warnung des
 *   Planers; im Ruhezustand nur nach einem gescheiterten Versuch, Ruling N-2), `custom_sound_failed`, sonst `ready`.
 * - Verfügbarkeit: `nichtVerfuegbar` (Gast) und `turnierBeendet` schalten still ab, ohne Ausnahme.
 * - Lautsprecher-Felder über die Tabs (`lautsprecherKanal.ts`) mit „bereit“ = `ready` oder `custom_sound_failed` (die Halle
 *   hört dann „Hupe 1“, @HT-028) und der Serverzeit der letzten Antwort je Feld (K3); der Halter erneuert die Meldung
 *   höchstens einmal je Sekunde (W-neu-1), auch wenn die Uhr zurücksprang (k4-neu-1: negatives Alter).
 * - H3b-3: `beimTakt` für das Lebenszeichen, `stillAbschalten` (Turnierende), Tonwahl-Wechsel erst in Ruhe (`tonWahlWechsel.ts`).
 */
import {
  LEERES_GEDAECHTNIS, hallTonGespielt, planeHallToene,
  type FeldStand, type GeplanterTon, type PlanErgebnis, type TonGedaechtnis,
} from '../../../core/hallenton';
import type { FeldStandQuelle } from './feldStand';
import type { LautsprecherFeldMeldung } from './lautsprecherKanal';
import { teileGedaechtnis, vereineGedaechtnis } from './geteiltesGedaechtnis';
import { erzeugeUhrsprungWache } from './uhrsprungWache';
import type { TaktQuelle } from './taktQuelle';
import {
  antwortAtVon, feldZustaende, meldeFelderAnTabs, geraeteZustandAus, naechsterTonAus, nurFreieEnden, tonFrei, warnFelderAus,
  type HallLautsprecherLaufzeit, type LaufzeitDeps, type LaufzeitRolle, type LaufzeitSnapshot,
} from './laufzeitZustand';
import { VORBELEGUNG } from './tonWahl';
import { erzeugeTonWahlHalter } from './tonWahlWechsel';
import { erzeugeTonSteuerung, type TonSteuerung } from './tonSteuerung';

export type { FeldZustand, HallLautsprecherLaufzeit, LaufzeitDeps, LaufzeitRolle, LaufzeitSnapshot, NaechsterTon } from './laufzeitZustand';

export function erzeugeHallLautsprecherLaufzeit(deps: LaufzeitDeps): HallLautsprecherLaufzeit {
  const { spieler, uhr } = deps;
  const zuhoerer = new Set<() => void>();
  const taktAufraeumen: Array<() => void> = [];
  let spielerAb: (() => void) | null = null;
  let rolle: LaufzeitRolle = 'aus';
  let freigeben: (() => void) | null = null;
  let takt: TaktQuelle | null = null;
  let fs: FeldStandQuelle | null = null;
  let toene: TonSteuerung | null = null;
  let gedaechtnis: TonGedaechtnis = LEERES_GEDAECHTNIS;
  let letzterPlan: PlanErgebnis | null = null;
  let staende: FeldStand[] = [];
  let staendeUm = 0;
  let warnFelder = new Set<string>();
  let runde: Promise<void> | null = null;
  let sperreAngefordert = false;
  let aktiviert = false;
  const wahl = erzeugeTonWahlHalter({ spieler, start: deps.tonWahl ?? VORBELEGUNG, lesen: deps.leseTonWahl, geladen: () => melden() });
  const taktZuhoerer = new Set<() => void>();
  const speicher = deps.gedaechtnisSpeicher ?? null;
  const wache = erzeugeUhrsprungWache(deps.uhrProbe, uhr);
  let geschlafen = deps.wurdeVerworfen;
  let ausgesetzt = false;
  let taktFehler = false;
  let warAngehalten = false;
  let gemeldet: readonly LautsprecherFeldMeldung[] | null = null;
  let snapshot: LaufzeitSnapshot = baue();

  function baue(): LaufzeitSnapshot {
    // ein nur zum „Anhören“ freigegebener Spieler macht den Tab nicht bereit (W2-neu-1)
    const geraet = geraeteZustandAus({ geschlafen, spieler: aktiviert ? spieler.zustand() : 'not_activated', ausgesetzt, taktFehler });
    return {
      rolle, turnierId: deps.turnierId, felder: deps.felder, geraeteZustand: geraet, taktFehler, warAngehalten,
      zustandJeFeld: feldZustaende(geraet, deps.felder, warnFelder),
      verfuegbarkeit: fs?.verfuegbarkeit() ?? null,
      naechsterTon: naechsterTonAus(toene?.naechster() ?? null, staende),
    };
  }

  function melden(): void {
    const neu = baue();
    if (JSON.stringify(neu) !== JSON.stringify(snapshot)) {
      snapshot = neu;
      for (const fn of [...zuhoerer]) {
        fn();
      }
    }
    if (rolle === 'toent') {
      gemeldet = meldeFelderAnTabs(deps.kanal, deps.turnierId, deps.felder, snapshot.zustandJeFeld, (id) => antwortAtVon(id, staende, staendeUm), staendeUm, gemeldet);
    }
  }

  const frei = (ton: GeplanterTon): boolean => tonFrei(ton, staende, staendeUm);

  function bestaetigen(now: number): void {
    for (const { ton, at } of toene?.bestaetigen(now) ?? []) {
      wahl.begonnen(at);
      gedaechtnis = hallTonGespielt(gedaechtnis, nurFreieEnden(ton, staende, staendeUm), at);
      teileGedaechtnis(speicher, deps.turnierId, gedaechtnis, at);
    }
  }

  /** Sperre und Takt abgeben (Ausschalten, Turnierende, Ausgabe steht); der Spieler bleibt abonniert. */
  function loslassen(neueRolle: LaufzeitRolle): void {
    toene?.allesAbbrechen(uhr.serverNow(), true);
    for (const fn of taktAufraeumen.splice(0)) {
      fn();
    }
    takt?.stop();
    takt = null;
    toene = null;
    freigeben?.();
    freigeben = null;
    sperreAngefordert = false;
    rolle = neueRolle;
    gemeldet = null;
    deps.kanal.melden(null);
  }

  function abschalten(neueRolle: LaufzeitRolle): void {
    loslassen(neueRolle);
    spielerAb?.();
    spielerAb = null;
    melden();
  }

  /** Synchron in jedem Takt: Stand am Server mit Antwort-Alter → Plan → Ton-Steuerung. */
  function planeJetzt(quelle: FeldStandQuelle, jetzt: number): void {
    const verfuegbar = quelle.verfuegbarkeit();
    if (verfuegbar === 'nichtVerfuegbar' || verfuegbar === 'turnierBeendet') {
      abschalten('still');
      return;
    }
    staende = quelle.staende();
    staendeUm = jetzt;
    const plan = planeHallToene({ felder: staende, serverNow: jetzt }, gedaechtnis);
    gedaechtnis = plan.gedaechtnis;
    letzterPlan = plan;
    toene?.uebernehmen(plan.toene, jetzt, frei);
    warnFelder = warnFelderAus(plan.warnungen, staende, quelle.letzterVersuchGescheitert());
  }

  function imTakt(): void {
    const quelle = fs;
    if (rolle !== 'toent' || !quelle) {
      return;
    }
    const sprung = wache.messen();
    // W1: mit der Zeit vor dem Sprung bestätigen, damit ein begonnener Ton gespielt bleibt und kein künftiger als gespielt gilt
    const now = uhr.serverNow() - (sprung ?? 0);
    bestaetigen(now);
    if (sprung !== null) {
      toene?.allesAbbrechen(now);
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
    toene?.pruefen(now, frei);
    wahl.imTakt(toene?.naechster() ?? null, now);
    melden();
    for (const fn of [...taktZuhoerer]) {
      fn();
    }
  }

  function beginne(): void {
    rolle = 'toent';
    const neuerTakt = deps.erzeugeTakt();
    takt = neuerTakt;
    toene = erzeugeTonSteuerung({ takt: neuerTakt, spieler });
    fs ??= deps.erzeugeFeldStand();
    taktAufraeumen.push(
      neuerTakt.onTakt(imTakt),
      neuerTakt.onWeckruf((id) => toene?.weckruf(id, uhr.serverNow(), frei)),
      neuerTakt.onAussetzer((ereignis) => {
        ausgesetzt = ereignis.art === 'beginn';
        warAngehalten ||= ereignis.art === 'ende';
        melden();
      }),
      neuerTakt.onFehler(() => {
        taktFehler = true;
        melden();
      }),
    );
    neuerTakt.start();
    taktFehler = neuerTakt.zustand() === 'fehler';
    gedaechtnis = vereineGedaechtnis(speicher, deps.turnierId, gedaechtnis, uhr.serverNow());
    melden();
  }

  /** W3: die Sperre erst, wenn der Spieler dieses Tabs aktiviert ist (sonst landete sie in einem stummen Tab). */
  function pruefeSperre(): void {
    if (rolle !== 'wartet' || sperreAngefordert || !aktiviert || spieler.zustand() === 'not_activated') {
      return;
    }
    sperreAngefordert = true;
    const loesen = deps.sperre.anfordern((meldung) => {
      if (rolle !== 'wartet' && rolle !== 'andererTab') {
        return;
      }
      if (meldung === 'erhalten') {
        beginne();
      } else {
        rolle = 'andererTab';
        melden();
      }
    });
    freigeben ??= loesen;
  }

  function beiSpielerZustand(): void {
    if ((rolle === 'toent' || rolle === 'andererTab') && spieler.zustand() === 'not_activated') {
      loslassen('wartet'); // k-neu-4: eine stehende Ausgabe hält die Sperre nicht fest
    }
    pruefeSperre();
    melden();
  }

  /** k-neu-3: Töne und Tonwahl erst für einen aktivierten Tab. */
  function wirdAktiviert(): void {
    if (aktiviert) {
      return;
    }
    aktiviert = true;
    deps.beimAktivieren?.();
  }

  return {
    start() {
      if (rolle !== 'aus') {
        return;
      }
      rolle = 'wartet';
      spielerAb = spieler.onZustand(beiSpielerZustand);
      if (spieler.zustand() !== 'not_activated') {
        wirdAktiviert(); // in diesem Tab schon aktiviert (z. B. vorige Laufzeit)
        void spieler.laden(wahl.wahl()).then(melden, melden);
      }
      pruefeSperre();
      melden();
    },
    stop() {
      if (rolle !== 'aus') {
        abschalten('aus');
      }
    },
    subscribe(fn) {
      zuhoerer.add(fn);
      return () => {
        zuhoerer.delete(fn);
      };
    },
    getSnapshot: () => snapshot,
    async tonAktivieren() {
      const freigabe = spieler.aktivieren(); // in der Geste, vor jedem await
      wirdAktiviert();
      let ok = await freigabe;
      if (!ok) {
        await spieler.laden(wahl.wahl());
        ok = spieler.zustand() !== 'not_activated';
      }
      if (ok) {
        geschlafen = false;
      }
      pruefeSperre();
      melden();
      return ok;
    },
    ladeToeneZumAnhoeren: () => wahl.zumAnhoeren(() => aktiviert),
    setzeTonWahl(neu) {
      const lage = !aktiviert ? 'nichtAktiviert' : rolle === 'toent' ? 'toent' : 'aktiviert';
      wahl.setzen(neu, lage, toene?.naechster() ?? null, uhr.serverNow());
    },
    beimTakt(fn) {
      taktZuhoerer.add(fn);
      return () => {
        taktZuhoerer.delete(fn);
      };
    },
    stillAbschalten() {
      if (rolle !== 'aus' && rolle !== 'still') {
        abschalten('still');
      }
    },
    angehaltenBestaetigen() {
      warAngehalten = false;
      melden();
    },
  };
}
