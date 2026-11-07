/**
 * Tonlaufzeit des Hallen-Lautsprechers (H3b-2b, Plan „H3b – Einbau“, Einbau-Vertrag des Planers): Zustandsspeicher ohne
 * React (`subscribe`/`getSnapshot`), alle Abhängigkeiten injiziert.
 *
 * - Sperre je Gerät (@HT-033 Zeile 8): Erst mit der Sperre entstehen Worker-Takt und Feldstand; ein Tab ohne Sperre zeigt
 *   `andererTab` und hat keine Last.
 * - Takt (250 ms aus dem Worker): `await feldStand.aktualisieren(serverNow, letzterPlan.abfrageTaktMs)`, dann `staende()` und
 *   `planeHallToene` mit dem Gedächtnis über die Takte hinweg. Läuft noch eine Runde, startet keine zweite; Freigabe und
 *   „gespielt“ prüft trotzdem jeder Takt (`tonSteuerung.ts`). `hallTonGespielt` erst nach dem tatsächlichen Beginn.
 * - Freigabe je Feld (@HT-011 ↔ @HT-029): frisch heißt, die Antwort **dieses Felds** (`quelle.antwortAlterMs`) liegt nicht
 *   vor `at − 3 s`; ein Feld nach eigenem Cockpit ist immer frei; ein Ton für mehrere Felder ist frei, wenn eines frei ist.
 * - Uhrsprung (`uhrsprungMs`): alles noch nicht Begonnene abbrechen, `sync()`, danach neu planen (@HT-010).
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
import { istAngepfiffen } from './feldStandSpiele';
import type { GeraeteSperre } from './geraeteSperre';
import type { HallTonSpieler, TonArt, TonWahl } from './hallTonSpieler';
import { MELDUNG_ERNEUERN_MS, type LautsprecherKanal } from './lautsprecherKanal';
import type { TaktQuelle } from './taktQuelle';
import {
  BEREIT, feldZustaende, geraeteZustandAus, naechsterTonAus, tonFrei, type LaufzeitRolle, type LaufzeitSnapshot,
} from './laufzeitZustand';
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
}

/** Vorbelegung „Hupe 1“ für beide Töne (@HT-025). */
const VORBELEGUNG: Record<TonArt, TonWahl> = { abpfiff: 'horn-1', halbzeit: 'horn-1' };

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
      gedaechtnis = hallTonGespielt(gedaechtnis, ton, at);
    }
  }

  function pruefeUhrsprung(): void {
    const jetzt = deps.uhrProbe();
    const sprung = probe === null ? null : uhrsprungMs(probe, jetzt);
    probe = jetzt;
    if (sprung === null || syncLaeuft) {
      return;
    }
    toene?.allesAbbrechen();
    syncLaeuft = true;
    void uhr.sync().catch(() => undefined).finally(() => {
      syncLaeuft = false;
      probe = deps.uhrProbe();
    });
  }

  function abschalten(neueRolle: LaufzeitRolle): void {
    toene?.allesAbbrechen(true);
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

  async function planeRunde(now: number): Promise<void> {
    const quelle = fs;
    if (!quelle) {
      return;
    }
    await quelle.aktualisieren(now, letzterPlan?.abfrageTaktMs ?? null);
    const verfuegbar = quelle.verfuegbarkeit();
    if (rolle !== 'toent' || syncLaeuft) {
      return;
    }
    if (verfuegbar === 'nichtVerfuegbar' || verfuegbar === 'turnierBeendet') {
      abschalten('still');
      return;
    }
    const jetzt = uhr.serverNow();
    bestaetigen(jetzt);
    staende = quelle.staende();
    staendeUm = jetzt;
    const plan = planeHallToene({ felder: staende, serverNow: jetzt }, gedaechtnis);
    gedaechtnis = plan.gedaechtnis;
    letzterPlan = plan;
    toene?.uebernehmen(plan.toene, jetzt, frei);
    const gescheitert = quelle.letzterVersuchGescheitert();
    const angepfiffen = (feldId: string): boolean => istAngepfiffen(staende.find((s) => s.feldId === feldId)?.state.status);
    warnFelder = new Set(plan.warnungen.filter((w) => gescheitert || angepfiffen(w.feldId)).map((w) => w.feldId));
  }

  function imTakt(): void {
    if (rolle !== 'toent') {
      return;
    }
    pruefeUhrsprung();
    const now = uhr.serverNow();
    bestaetigen(now);
    toene?.pruefen(now, frei);
    if (runde === null && !syncLaeuft) {
      runde = planeRunde(now).catch(() => undefined).finally(() => {
        runde = null;
        melden();
      });
    }
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
    void spieler.laden(deps.tonWahl ?? VORBELEGUNG).then(melden, melden);
    melden();
  }

  return {
    start() {
      if (rolle !== 'aus') {
        return;
      }
      rolle = 'wartet';
      aufraeumen.push(spieler.onZustand(melden));
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
      melden();
      return ok;
    },
    angehaltenBestaetigen() {
      warAngehalten = false;
      melden();
    },
  };
}
