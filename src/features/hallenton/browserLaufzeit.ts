/**
 * Die Lautsprecher-Laufzeit mit den Bausteinen des Browsers (H3b-2b): Worker-Takt, Web-Audio-Spieler des Tabs, Feldstand gegen
 * Supabase, Uhr der Engine (`ClockSync`), Web Lock, `BroadcastChannel` und `localStorage`. Ohne React, damit der Baustein in
 * `App.tsx` nur noch ein- und ausschaltet.
 *
 * - Regel 2: „Leite ich das Feld?“ aus dem zuletzt gelesenen Steuer-Stand (`ownFieldsByTournament`, gefüllt von
 *   `useFieldControl`), der Stand der eigenen Engine aus `view(id).result.state` (mit lokalen Ausstehenden).
 * - Start ohne Netz: der Spielplan aus der lokalen Turnierkopie gilt, bis der Server einen liefert (Befund 6a).
 * - Tonwahl (Fixrunde 1): die Abpfiff-Hupe aus derselben lokalen Turnierkopie (`matchCockpitSettings.soundId`, ohne Engine
 *   und Router), Halbzeit-Ton und eigene Töne aus `hall_sound_status` (`tonWahl.ts`); bis dahin „Hupe 1“. H3b-3: nach jedem
 *   Lebenszeichen des tönenden Tabs neu gelesen (k-neu-2), vor „Anhören“ in einem nicht aktivierten Tab ebenso (k4-neu-2).
 * - H3b-3: Lebenszeichen des Lautsprechers (`lautsprecherLebenszeichen.ts`, Melde-Sperre `hallenton-melden`); „leite ich
 *   Feld X?“ über ein Neuladen ohne Netz hinweg (`steuerStandMerker.ts`, Befund 6a).
 */
import { getDeviceId } from '../../core/device/deviceId';
import { onOwnFieldsNoted, ownFieldsByTournament } from '../../core/fieldControl/ownFields';
import { hallSoundStatus, hallSpeakerHeartbeat, hallTestToneAck } from '../../core/repositories/hallentonRpc';
import { supabase } from '../../lib/supabase';
import type { Tournament } from '../../types/tournament';
import type { MatchEngineContextValue } from '../match-engine/matchEngineContextInstance';
import { geraetSpieler, geraetStand, istGeschlafen, setzeEinschaltung, type Einschaltung } from './lautsprecherGeraet';
import { erzeugeBrowserAusgangsSignale } from './runtime/ausgangsSignale';
import { erzeugeFeldStand } from './runtime/feldStand';
import type { PlanSpiel } from './runtime/feldStandSpiele';
import { erzeugeBrowserSperre } from './runtime/geraeteSperre';
import type { TonArt, TonWahl } from './runtime/hallTonSpieler';
import { erzeugeLebenszeichen, MELDE_SPERRE_NAME } from './runtime/lautsprecherLebenszeichen';
import { erzeugeSteuerStandMerker, type SteuerStandMerker } from './runtime/steuerStandMerker';
import { erzeugeHallLautsprecherLaufzeit, type HallLautsprecherLaufzeit } from './runtime/HallLautsprecherLaufzeit';
import { browserKanalSpeicher, erzeugeLautsprecherKanal, KANAL_NAME, type LautsprecherKanal, type NachrichtenKanal } from './runtime/lautsprecherKanal';
import { planAusTurnier } from './runtime/lokalerSpielplan';
import { erzeugeBrowserTaktQuelle } from './runtime/taktQuelle';
import { tonWahlAus } from './runtime/tonWahl';
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

/** Tonwahl des Turniers: Abpfiff-Hupe aus der lokalen Turnierkopie, Halbzeit und eigene Töne aus `hall_sound_status`. */
export async function leseTonWahl(turnierId: string, ladeTurnier: LadeTurnier): Promise<Record<TonArt, TonWahl>> {
  const [turnier, status] = await Promise.all([
    ladeTurnier(turnierId).catch(() => null),
    hallSoundStatus(supabase, { p_tournament_id: turnierId, p_device_id: getDeviceId() }),
  ]);
  const settings = status.ok && status.sicht === 'voll' ? status.settings : null;
  return tonWahlAus(turnier?.matchCockpitSettings?.soundId, settings, oeffentlicheUrl);
}

let steuerStand: SteuerStandMerker | null = null;

/** Merkt den Steuer-Stand des Lautsprecher-Turniers ab dem ersten Aufruf (der Baustein ruft ihn beim Einhängen). */
export function browserSteuerStand(): SteuerStandMerker {
  steuerStand ??= erzeugeSteuerStandMerker({
    speicher: browserKanalSpeicher(),
    eigeneFelder: ownFieldsByTournament,
    abonniere: onOwnFieldsNoted,
    merkenFuer: (turnierId) => geraetStand().einschaltung?.turnierId === turnierId,
  });
  return steuerStand;
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
      leiteIchFeld: (feld) => browserSteuerStand().leiteIchFeld(turnierId, feld),
      eigeneSicht: (matchId) => engine.engine.view(matchId)?.result.state ?? null,
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
    leseTonWahl: () => leseTonWahl(turnierId, ladeTurnier),
  });
  function neuLesen(): void {
    void leseTonWahl(turnierId, ladeTurnier).then((wahl) => {
      if (!beendet) {
        laufzeit.setzeTonWahl(wahl);
      }
    });
  }
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
    // Regel 1: erst die Laufzeit stoppen (kein Ton danach), dann die Einschaltung kürzen bzw. löschen
    abgeloest: (bleiben) => {
      laufzeit.stop();
      setzeEinschaltung(bleiben.length > 0 ? { ...einschaltung, felder: bleiben } : null);
    },
    nachLebenszeichen: neuLesen,
  });
  return {
    laufzeit,
    starten: () => {
      laufzeit.start();
      lebenszeichen.start();
    },
    beenden: () => {
      beendet = true;
      lebenszeichen.stop();
      laufzeit.stop();
      kanal.schliessen();
    },
  };
}
