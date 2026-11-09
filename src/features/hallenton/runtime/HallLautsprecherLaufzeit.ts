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
 * - H3c: Torhymne (`torhymnenSteuerung.ts`) im Takt nach dem Plan, aus mit der Sperre, geladen ab der Aktivierung.
 */
import type { LautsprecherFeldMeldung } from './lautsprecherKanal';
import { antwortAtVon, feldZustaende, meldeFelderAnTabs, geraeteZustandAus, naechsterTonAus, type HallLautsprecherLaufzeit, type LaufzeitDeps, type LaufzeitRolle, type LaufzeitSnapshot } from './laufzeitZustand';
import { erzeugeRollenHalter } from './laufzeitRolle';
import { erzeugeLaufzeitTakt } from './laufzeitTakt';
import { VORBELEGUNG } from './tonWahl';
import { erzeugeTonWahlHalter } from './tonWahlWechsel';
import { erzeugeTorhymnenSteuerung } from './torhymnenSteuerung';

export type { FeldZustand, HallLautsprecherLaufzeit, LaufzeitDeps, LaufzeitRolle, LaufzeitSnapshot, NaechsterTon } from './laufzeitZustand';

export function erzeugeHallLautsprecherLaufzeit(deps: LaufzeitDeps): HallLautsprecherLaufzeit {
  const { spieler, uhr } = deps;
  const zuhoerer = new Set<() => void>();
  let spielerAb: (() => void) | null = null;
  const wahl = erzeugeTonWahlHalter({ spieler, start: deps.tonWahl ?? VORBELEGUNG, lesen: deps.leseTonWahl, geladen: () => melden() });
  const tor = erzeugeTorhymnenSteuerung({ spieler, start: deps.torWahl });
  let geschlafen = deps.wurdeVerworfen;
  let gemeldet: readonly LautsprecherFeldMeldung[] | null = null;
  // Rolle/Sperre (`laufzeitRolle.ts`) und Takt (`laufzeitTakt.ts`) greifen über die Funktionen unten ineinander
  const r = erzeugeRollenHalter({
    spieler, sperre: deps.sperre, tor, beimAktivieren: deps.beimAktivieren,
    beginne: () => beginne(), loslassen: (neueRolle) => loslassen(neueRolle), melden: () => melden(),
  });
  const takt = erzeugeLaufzeitTakt({ deps, rolle: r.rolle, abschalten: (neueRolle) => abschalten(neueRolle), melden: () => melden(), wahl, tor });
  const z = takt.z;
  let snapshot: LaufzeitSnapshot = baue();

  function baue(): LaufzeitSnapshot {
    // ein nur zum „Anhören“ freigegebener Spieler macht den Tab nicht bereit (W2-neu-1)
    const geraet = geraeteZustandAus({ geschlafen, spieler: r.aktiviert() ? spieler.zustand() : 'not_activated', ausgesetzt: z.ausgesetzt, taktFehler: z.taktFehler });
    return {
      rolle: r.rolle(), turnierId: deps.turnierId, felder: deps.felder, geraeteZustand: geraet, taktFehler: z.taktFehler, warAngehalten: z.warAngehalten,
      zustandJeFeld: feldZustaende(geraet, deps.felder, z.warnFelder),
      verfuegbarkeit: z.fs?.verfuegbarkeit() ?? null,
      naechsterTon: naechsterTonAus(z.toene?.naechster() ?? null, z.staende),
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
    if (r.rolle() === 'toent') {
      gemeldet = meldeFelderAnTabs(deps.kanal, deps.turnierId, deps.felder, snapshot.zustandJeFeld, (id) => antwortAtVon(id, z.staende, z.staendeUm), z.staendeUm, gemeldet);
    }
  }

  /** Sperre und Takt abgeben (Ausschalten, Turnierende, Ausgabe steht); der Spieler bleibt abonniert. */
  function loslassen(neueRolle: LaufzeitRolle): void {
    takt.beenden();
    r.sperreFreigeben();
    r.setze(neueRolle);
    gemeldet = null;
    deps.kanal.melden(null);
  }

  function abschalten(neueRolle: LaufzeitRolle): void {
    loslassen(neueRolle);
    spielerAb?.();
    spielerAb = null;
    melden();
  }

  function beginne(): void {
    r.setze('toent');
    takt.beginnen();
    melden();
  }

  return {
    start() {
      if (r.rolle() !== 'aus') {
        return;
      }
      r.setze('wartet');
      spielerAb = spieler.onZustand(r.beiSpielerZustand);
      if (spieler.zustand() !== 'not_activated') {
        r.wirdAktiviert(); // in diesem Tab schon aktiviert (z. B. vorige Laufzeit)
        void spieler.laden(wahl.wahl()).then(melden, melden);
      }
      r.pruefeSperre();
      melden();
    },
    stop() {
      if (r.rolle() !== 'aus') {
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
      r.wirdAktiviert();
      let ok = await freigabe;
      if (!ok) {
        await spieler.laden(wahl.wahl());
        ok = spieler.zustand() !== 'not_activated';
      }
      if (ok) {
        geschlafen = false;
      }
      r.pruefeSperre();
      melden();
      return ok;
    },
    ladeToeneZumAnhoeren: () => wahl.zumAnhoeren(r.aktiviert).then(() => tor.zumAnhoeren(deps.leseTorWahl?.())),
    setzeTorWahl: (neu) => tor.setzen(neu),
    setzeTonWahl(neu) {
      const rolle = r.rolle();
      const lage = !r.aktiviert() ? 'nichtAktiviert' : rolle === 'toent' ? 'toent' : 'aktiviert';
      wahl.setzen(neu, lage, z.toene?.naechster() ?? null, uhr.serverNow());
    },
    beimTakt: takt.beimTakt,
    stillAbschalten() {
      const rolle = r.rolle();
      if (rolle !== 'aus' && rolle !== 'still') {
        abschalten('still');
      }
    },
    angehaltenBestaetigen() {
      z.warAngehalten = false;
      melden();
    },
  };
}
