/**
 * Tonlaufzeit des Hallen-Lautsprechers (H3b-2b, Plan „H3b – Einbau“, Einbau-Vertrag des Planers): Zustandsspeicher ohne
 * React (`subscribe`/`getSnapshot`), alle Abhängigkeiten injiziert.
 *
 * - Sperre je Gerät (@HT-033 Zeile 8): Ein Tab fordert sie erst an, wenn sein Spieler aktiviert ist (Ruling W3); bis dahin
 *   `wartet` er ohne Last. Erst mit der Sperre entstehen Worker-Takt und Feldstand; ein Tab ohne Sperre zeigt `andererTab`.
 * - Takt (250 ms aus dem Worker): `bestaetigen` → Uhrsprung → synchron `staende()` und `planeHallToene` mit dem Gedächtnis →
 *   Freigabe. Die Netzrunde `feldStand.aktualisieren(serverNow, letzterPlan.abfrageTaktMs)` wird nur angestoßen, nie
 *   abgewartet; läuft sie noch, startet keine zweite (K1: der Stand der eigenen Engine gilt in jedem Takt).
 *   `hallTonGespielt` erst nach dem tatsächlichen Beginn; das Gedächtnis teilen die Tabs je Turnier (W2).
 * - Freigabe je Feld (@HT-011 ↔ @HT-029): frisch heißt, die Antwort **dieses Felds** (`quelle.antwortAlterMs`) liegt nicht
 *   vor `at − 3 s`; ein Feld nach eigenem Cockpit ist immer frei; ein Ton für mehrere Felder ist frei, wenn eines frei ist.
 * - Uhrsprung (`uhrsprungMs`): erst bestätigen (mit der Zeit vor dem Sprung), dann alles noch nicht Begonnene abbrechen,
 *   `sync()`, danach neu planen (@HT-010, W1).
 * - Zustand je Feld: `slept` (bis „Ton aktivieren“, @HT-037), `not_activated` (@HT-012/013), `background` (Takt setzt länger
 *   als 3 s aus oder Worker gescheitert, nie bloßes Verdecken, @HT-014), `volume_zero`, `keineVerbindung` (Warnung des
 *   Planers; im Ruhezustand nur nach einem gescheiterten Versuch, Ruling N-2), `custom_sound_failed`, sonst `ready`.
 * - Verfügbarkeit: `nichtVerfuegbar` (Gast) und `turnierBeendet` schalten still ab, ohne Ausnahme.
 * - Lautsprecher-Felder über die Tabs (`lautsprecherKanal.ts`) mit „bereit“ = `ready` oder `custom_sound_failed` (die Halle
 *   hört dann „Hupe 1“, @HT-028).
 */
import {
  LEERES_GEDAECHTNIS, hallTonGespielt, planeHallToene, uhrsprungMs,
  type FeldStand, type GeplanterTon, type PlanErgebnis, type TonGedaechtnis, type UhrProbe,
} from '../../../core/hallenton';
import { feldKennung } from './aktuellesSpielJeFeld';
import type { FeldStandQuelle } from './feldStand';
import type { GeraeteSperre } from './geraeteSperre';
import { teileGedaechtnis, vereineGedaechtnis } from './geteiltesGedaechtnis';
import type { HallTonSpieler, TonArt, TonWahl } from './hallTonSpieler';
import { MELDUNG_ERNEUERN_MS, type KanalSpeicher, type LautsprecherKanal } from './lautsprecherKanal';
import type { TaktQuelle } from './taktQuelle';
import {
  BEREIT, feldZustaende, geraeteZustandAus, naechsterTonAus, nurFreieEnden, tonFrei, warnFelderAus,
  type LaufzeitRolle, type LaufzeitSnapshot,
} from './laufzeitZustand';
import { VORBELEGUNG } from './tonWahl';
import { erzeugeTonSteuerung, type TonSteuerung } from './tonSteuerung';

export type { FeldZustand, LaufzeitRolle, LaufzeitSnapshot, NaechsterTon } from './laufzeitZustand';

export interface HallLautsprecherLaufzeit {
  start(): void;
  stop(): void;
  subscribe(fn: () => void): () => void;
  getSnapshot(): LaufzeitSnapshot;
  /** Aus der Nutzergeste „Ton aktivieren“ (@HT-012). */
  tonAktivieren(): Promise<boolean>;
  angehaltenBestaetigen(): void;
  /** Tonwahl des Turniers (Abpfiff aus `matchCockpitSettings.soundId`, Halbzeit/eigene Töne aus `hall_sound_status`). */
  setzeTonWahl(wahl: Record<TonArt, TonWahl>): void;
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
}

export function erzeugeHallLautsprecherLaufzeit(deps: LaufzeitDeps): HallLautsprecherLaufzeit {
  const { spieler, uhr } = deps;
  const zuhoerer = new Set<() => void>();
  const aufraeumen: Array<() => void> = [];
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
  let tonWahl = deps.tonWahl ?? VORBELEGUNG;
  const speicher = deps.gedaechtnisSpeicher ?? null;
  let syncLaeuft = false;
  let probe: UhrProbe | null = null;
  let geschlafen = deps.wurdeVerworfen;
  let ausgesetzt = false;
  let taktFehler = false;
  let warAngehalten = false;
  let gemeldet: { text: string; um: number } | null = null;
  let snapshot: LaufzeitSnapshot = baue();

  function baue(): LaufzeitSnapshot {
    const geraet = geraeteZustandAus({ geschlafen, spieler: spieler.zustand(), ausgesetzt, taktFehler });
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
    if (rolle !== 'toent') {
      return;
    }
    const felder = deps.felder.map((feld) => ({ feld, bereit: BEREIT.has(snapshot.zustandJeFeld[feldKennung(feld)]) }));
    const text = JSON.stringify(felder);
    const um = uhr.serverNow();
    if (gemeldet?.text !== text || um - gemeldet.um >= MELDUNG_ERNEUERN_MS) {
      gemeldet = { text, um };
      deps.kanal.melden({ turnierId: deps.turnierId, felder });
    }
  }

  const frei = (ton: GeplanterTon): boolean => tonFrei(ton, staende, staendeUm);

  function bestaetigen(now: number): void {
    for (const { ton, at } of toene?.bestaetigen(now) ?? []) {
      gedaechtnis = hallTonGespielt(gedaechtnis, nurFreieEnden(ton, staende, staendeUm), at);
      teileGedaechtnis(speicher, deps.turnierId, gedaechtnis, at);
    }
  }

  /** Sprung der Geräteuhr seit dem letzten Takt (ms) oder `null`; ändert nur die Probe. */
  function messeUhrsprung(): number | null {
    const jetzt = deps.uhrProbe();
    const sprung = probe === null || syncLaeuft ? null : uhrsprungMs(probe, jetzt);
    probe = jetzt;
    return sprung;
  }

  function nachUhrsprung(now: number): void {
    toene?.allesAbbrechen(now);
    syncLaeuft = true;
    void uhr.sync().catch(() => undefined).finally(() => {
      syncLaeuft = false;
      probe = deps.uhrProbe();
    });
  }

  function abschalten(neueRolle: LaufzeitRolle): void {
    toene?.allesAbbrechen(uhr.serverNow(), true);
    sperreAngefordert = false;
    for (const fn of aufraeumen.splice(0)) {
      fn();
    }
    takt?.stop();
    takt = null;
    toene = null;
    freigeben?.();
    freigeben = null;
    rolle = neueRolle;
    gemeldet = null;
    deps.kanal.melden(null);
    melden();
  }

  /** Synchron in jedem Takt: aktueller Stand (eigene Engine sofort, Server mit Antwort-Alter) → Plan → Ton-Steuerung. */
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
    const sprung = messeUhrsprung();
    // W1: mit der Zeit vor dem Sprung bestätigen, damit ein begonnener Ton gespielt bleibt und kein künftiger als gespielt gilt
    const now = uhr.serverNow() - (sprung ?? 0);
    bestaetigen(now);
    if (sprung !== null) {
      nachUhrsprung(now);
    }
    if (runde === null && !syncLaeuft) {
      runde = quelle.aktualisieren(now, letzterPlan?.abfrageTaktMs ?? null).catch(() => undefined).finally(() => {
        runde = null;
      });
    }
    if (!syncLaeuft) {
      planeJetzt(quelle, now);
    }
    toene?.pruefen(now, frei);
    melden();
  }

  function beginne(): void {
    rolle = 'toent';
    const neuerTakt = deps.erzeugeTakt();
    takt = neuerTakt;
    toene = erzeugeTonSteuerung({ takt: neuerTakt, spieler });
    fs ??= deps.erzeugeFeldStand();
    aufraeumen.push(
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
    if (rolle !== 'wartet' || sperreAngefordert || spieler.zustand() === 'not_activated') {
      return;
    }
    sperreAngefordert = true;
    const loesen = deps.sperre.anfordern((meldung) => {
      if (rolle === 'aus' || rolle === 'still') {
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

  return {
    start() {
      if (rolle !== 'aus') {
        return;
      }
      rolle = 'wartet';
      aufraeumen.push(spieler.onZustand(() => {
        pruefeSperre();
        melden();
      }));
      void spieler.laden(tonWahl).then(melden, melden);
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
      const ok = await spieler.aktivieren();
      if (ok) {
        geschlafen = false;
      }
      pruefeSperre();
      melden();
      return ok;
    },
    setzeTonWahl(wahl) {
      tonWahl = wahl;
      void spieler.laden(wahl).then(melden, melden);
    },
    angehaltenBestaetigen() {
      warAngehalten = false;
      melden();
    },
  };
}
