/**
 * Die Lautsprecher-Laufzeit mit den Bausteinen des Browsers (H3b-2b): Worker-Takt, Web-Audio-Spieler des Tabs, Feldstand gegen
 * Supabase, Uhr der Engine (`ClockSync`), Web Lock, `BroadcastChannel` und `localStorage`. Ohne React, damit der Baustein in
 * `App.tsx` nur noch ein- und ausschaltet.
 *
 * - Regel 2 („Hupe und Anzeige sagen dasselbe“, 07.11.): nur der Stand am Server, auch wenn dieses Gerät das Feld leitet;
 *   die Uhr ist die der Engine (`ClockSync`, gleicht sich mit dem Server ab, solange ein Konto angemeldet ist).
 * - Start ohne Netz: der Spielplan aus der lokalen Turnierkopie gilt, bis der Server einen liefert – die Felder warnen dann
 *   „keine Verbindung“ (Befund 6a).
 * - Tonwahl (Fixrunde 1): die Abpfiff-Hupe aus derselben lokalen Turnierkopie (`matchCockpitSettings.soundId`, ohne Engine
 *   und Router), Halbzeit-Ton und eigene Töne aus `hall_sound_status` (`tonWahl.ts`); bis dahin „Hupe 1“. H3b-3: nach jedem
 *   Lebenszeichen des tönenden Tabs neu gelesen (k-neu-2), vor „Anhören“ in einem nicht aktivierten Tab ebenso (k4-neu-2).
 *   H3c: „Ton bei Tor“ und Torhymnen aus derselben Antwort (`bekannteTorWahl`).
 * - H3b-3: Lebenszeichen des Lautsprechers (`lautsprecherLebenszeichen.ts`, Melde-Sperre `hallenton-melden`).
 */
import { getDeviceId } from '../../core/device/deviceId';
import { hallSoundStatus, hallSpeakerHeartbeat, hallTestToneAck, type HallStatusVoll } from '../../core/repositories/hallentonRpc';
import { isTournamentClosed } from '../../core/services/lifecycle';
import { supabase } from '../../lib/supabase';
import type { Tournament } from '../../types/tournament';
import type { MatchEngineContextValue } from '../match-engine/matchEngineContextInstance';
import { beiErneutVersuchen, geraetSpieler, istGeschlafen, merkeAbloesung, setzeEinschaltung, setzeLebenszeichenFehler, type Einschaltung } from './lautsprecherGeraet';
import { erzeugeBrowserAusgangsSignale } from './runtime/ausgangsSignale';
import { erzeugeFeldStand } from './runtime/feldStand';
import type { PlanSpiel } from './runtime/feldStandSpiele';
import { erzeugeBrowserSperre } from './runtime/geraeteSperre';
import type { TonArt, TonWahl } from './runtime/hallTonSpieler';
import { erzeugeLebenszeichen, MELDE_SPERRE_NAME } from './runtime/lautsprecherLebenszeichen';
import { erzeugeHallLautsprecherLaufzeit, type HallLautsprecherLaufzeit } from './runtime/HallLautsprecherLaufzeit';
import { browserKanalSpeicher, erzeugeLautsprecherKanal, KANAL_NAME, type LautsprecherKanal, type NachrichtenKanal } from './runtime/lautsprecherKanal';
import { planAusTurnier } from './runtime/lokalerSpielplan';
import { erzeugeBrowserTaktQuelle } from './runtime/taktQuelle';
import { tonWahlAus, torWahlAus } from './runtime/tonWahl';
import type { TorWahl } from './runtime/torhymnenSteuerung';
import { einzelnZugleich } from './runtime/tonWahlWechsel';
import { echterZeitgeber } from './runtime/zeitgeber';

/** Bucket der eigenen Töne (Migration 20261121_001_hallenton, öffentlich lesbar über den vollen Pfad). */
const TON_BUCKET = 'hallenton-sounds';

function oeffentlicheUrl(pfad: string): string {
  return supabase?.storage.from(TON_BUCKET).getPublicUrl(pfad).data.publicUrl ?? '';
}

function browserNachrichtenKanal(): NachrichtenKanal | null {
  return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(KANAL_NAME);
}

/** Kanal der Lautsprecher-Felder dieses Tabs (eigene `BroadcastChannel`-Instanz). */
export function erzeugeBrowserKanal(): LautsprecherKanal {
  return erzeugeLautsprecherKanal({
    speicher: browserKanalSpeicher(),
    kanal: browserNachrichtenKanal(),
    tabId: Math.random().toString(36).slice(2),
    jetzt: () => Date.now(),
    seite: typeof window === 'undefined' ? null : window,
  });
}

type LadeTurnier = (turnierId: string) => Promise<Tournament | null>;

/** Zuletzt vom Server gelesene Tonwahl je Turnier (für „Anhören“ ohne Warten aufs Netz, K5). */
const zuletztGelesen = new Map<string, HallStatusVoll['settings']>();

/**
 * Tonwahl des Turniers: Abpfiff-Hupe aus der lokalen Turnierkopie (`ladeTurnier` liest nur lokal, W2), Halbzeit und eigene
 * Töne aus `hall_sound_status`. `server: false` nimmt die zuletzt gelesene Wahl, ohne aufs Netz zu warten.
 */
export async function leseTonWahl(turnierId: string, ladeTurnier: LadeTurnier, { server = true }: { server?: boolean } = {}): Promise<Record<TonArt, TonWahl>> {
  const [turnier, status] = await Promise.all([
    ladeTurnier(turnierId).catch(() => null),
    server ? hallSoundStatus(supabase, { p_tournament_id: turnierId, p_device_id: getDeviceId() }) : Promise.resolve(null),
  ]);
  if (status?.ok && status.sicht === 'voll') {
    zuletztGelesen.set(turnierId, status.settings);
  }
  return tonWahlAus(turnier?.matchCockpitSettings?.soundId, zuletztGelesen.get(turnierId) ?? null, oeffentlicheUrl);
}

/** „Ton bei Tor“ und Torhymnen nach der zuletzt vom Server gelesenen Tonwahl (H3c, @HT-024); vorher keine. */
export function bekannteTorWahl(turnierId: string): TorWahl {
  return torWahlAus(zuletztGelesen.get(turnierId) ?? null, oeffentlicheUrl);
}

/**
 * „Anhören“ der Torhymne ohne Laufzeit: kennt das Gerät schon Hymnen, sofort mit diesen (neu lesen im Hintergrund, K5);
 * sonst einmal vom Server lesen – gerade hochgeladene Hymnen sollen ohne Neuladen hörbar sein.
 */
export async function leseTorWahlZumAnhoeren(turnierId: string, ladeTurnier: LadeTurnier): Promise<TorWahl> {
  const bekannt = bekannteTorWahl(turnierId);
  const lesen = leseTonWahl(turnierId, ladeTurnier).catch(() => undefined);
  if (bekannt.hymnen.length === 0) {
    await lesen;
  }
  return bekannt.hymnen.length > 0 ? bekannt : bekannteTorWahl(turnierId);
}

/** K5: sofort mit der lokal bekannten Wahl, die Wahl vom Server im Hintergrund neu lesen. */
export function leseTonWahlSofort(turnierId: string, ladeTurnier: LadeTurnier): Promise<Record<TonArt, TonWahl>> {
  void leseTonWahl(turnierId, ladeTurnier).catch(() => undefined);
  return leseTonWahl(turnierId, ladeTurnier, { server: false });
}

export interface BrowserLaufzeitDeps {
  einschaltung: Einschaltung;
  engine: MatchEngineContextValue;
  ladeTurnier: LadeTurnier;
}

export interface BrowserLaufzeit {
  laufzeit: HallLautsprecherLaufzeit;
  starten: () => void;
  beenden: () => void;
}

export function erzeugeBrowserLaufzeit({ einschaltung, engine, ladeTurnier }: BrowserLaufzeitDeps): BrowserLaufzeit {
  const { turnierId, felder } = einschaltung;
  let lokal: PlanSpiel[] | null = null;
  let beendet = false;
  const kanal = erzeugeBrowserKanal();
  const laufzeit = erzeugeHallLautsprecherLaufzeit({
    turnierId,
    felder,
    erzeugeTakt: erzeugeBrowserTaktQuelle,
    spieler: geraetSpieler(),
    erzeugeFeldStand: () => erzeugeFeldStand({
      client: supabase,
      serverNow: () => engine.clock.serverNow(),
      turnierId,
      lautsprecherFelder: () => felder,
      lokalerSpielplan: () => lokal,
    }),
    uhr: engine.clock,
    uhrProbe: () => ({ wandMs: Date.now(), monoMs: performance.now() }),
    sperre: erzeugeBrowserSperre(),
    kanal,
    wurdeVerworfen: istGeschlafen(),
    gedaechtnisSpeicher: browserKanalSpeicher(),
    // k-neu-3: erst ein aktivierter Tab liest Turnier (lokal) und Tonwahl (Server); wartende Tabs haben keine Last
    beimAktivieren: () => {
      void ladeTurnier(turnierId).catch(() => null).then((t) => {
        lokal = t ? planAusTurnier(t) : null;
      });
      neuLesen();
    },
    leseTonWahl: () => leseTonWahlSofort(turnierId, ladeTurnier),
    leseTorWahl: () => bekannteTorWahl(turnierId),
  });
  /** Nach jedem Lebenszeichen des tönenden Tabs; eine laufende Abfrage wird nicht verdoppelt (W2). */
  const neuLesen = einzelnZugleich(() => leseTonWahl(turnierId, ladeTurnier).then((wahl) => {
    if (!beendet) {
      laufzeit.setzeTonWahl(wahl);
      laufzeit.setzeTorWahl(bekannteTorWahl(turnierId));
    }
  }));
  const lebenszeichen = erzeugeLebenszeichen({
    turnierId,
    felder,
    deviceId: getDeviceId(),
    laufzeit,
    spieler: geraetSpieler(),
    erzeugeAusgang: () => erzeugeBrowserAusgangsSignale(geraetSpieler().audioKontext()),
    sperre: erzeugeBrowserSperre(MELDE_SPERRE_NAME),
    kanal,
    zeitgeber: echterZeitgeber,
    rpc: { heartbeat: (args) => hallSpeakerHeartbeat(supabase, args), ack: (args) => hallTestToneAck(supabase, args) },
    speicher: browserKanalSpeicher(),
    // Regel 1: erst die Laufzeit stoppen (kein Ton danach), dann die Spur merken (@HT-015, H4-1), dann die Einschaltung kürzen bzw. löschen
    abgeloest: (bleiben, verloren) => {
      laufzeit.stop();
      merkeAbloesung(turnierId, verloren, engine.clock.serverNow());
      setzeEinschaltung(bleiben.length > 0 ? { ...einschaltung, felder: bleiben } : null);
    },
    nachLebenszeichen: neuLesen,
    turnierBeendet: async () => {
      const turnier = await ladeTurnier(turnierId).catch(() => null);
      return turnier !== null && isTournamentClosed(turnier);
    },
    beiFehler: (grund) => {
      if (!beendet) {
        setzeLebenszeichenFehler(grund);
      }
    },
  });
  let erneutAb: (() => void) | null = null;
  return {
    laufzeit,
    starten: () => {
      laufzeit.start();
      lebenszeichen.start();
      erneutAb = beiErneutVersuchen(() => {
        lebenszeichen.wiederAufnehmen(); // N2: Neu-Anmeldung oder Taste beenden ein „still“ nach kein_recht
      });
    },
    beenden: () => {
      beendet = true;
      erneutAb?.();
      erneutAb = null;
      lebenszeichen.stop();
      laufzeit.stop();
      kanal.schliessen();
    },
  };
}
