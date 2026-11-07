/**
 * Die Lautsprecher-Laufzeit mit den Bausteinen des Browsers (H3b-2b): Worker-Takt, Web-Audio-Spieler des Tabs, Feldstand gegen
 * Supabase, Uhr der Engine (`ClockSync`), Web Lock, `BroadcastChannel` und `localStorage`. Ohne React, damit der Baustein in
 * `App.tsx` nur noch ein- und ausschaltet.
 *
 * - Regel 2: „Leite ich das Feld?“ aus dem zuletzt gelesenen Steuer-Stand (`ownFieldsByTournament`, gefüllt von
 *   `useFieldControl`), der Stand der eigenen Engine aus `view(id).result.state` (mit lokalen Ausstehenden).
 * - Start ohne Netz: der Spielplan aus der lokalen Turnierkopie gilt, bis der Server einen liefert (Befund 6a).
 * - Tonwahl (Fixrunde 1): die Abpfiff-Hupe aus derselben lokalen Turnierkopie (`matchCockpitSettings.soundId`, ohne Engine
 *   und Router), Halbzeit-Ton und eigene Töne aus `hall_sound_status` (`tonWahl.ts`); bis dahin „Hupe 1“.
 */
import { getDeviceId } from '../../core/device/deviceId';
import { ownFieldsByTournament } from '../../core/fieldControl/ownFields';
import { hallSoundStatus } from '../../core/repositories/hallentonRpc';
import { supabase } from '../../lib/supabase';
import type { Tournament } from '../../types/tournament';
import type { MatchEngineContextValue } from '../match-engine/matchEngineContextInstance';
import { geraetSpieler, istGeschlafen, type Einschaltung } from './lautsprecherGeraet';
import { erzeugeFeldStand } from './runtime/feldStand';
import type { PlanSpiel } from './runtime/feldStandSpiele';
import { erzeugeBrowserSperre } from './runtime/geraeteSperre';
import { erzeugeHallLautsprecherLaufzeit, type HallLautsprecherLaufzeit } from './runtime/HallLautsprecherLaufzeit';
import { browserKanalSpeicher, erzeugeLautsprecherKanal, KANAL_NAME, type LautsprecherKanal, type NachrichtenKanal } from './runtime/lautsprecherKanal';
import { planAusTurnier } from './runtime/lokalerSpielplan';
import { erzeugeBrowserTaktQuelle } from './runtime/taktQuelle';
import { tonWahlAus } from './runtime/tonWahl';

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
  });
}

export interface BrowserLaufzeitDeps {
  einschaltung: Einschaltung;
  engine: MatchEngineContextValue;
  ladeTurnier: (turnierId: string) => Promise<Tournament | null>;
}

export function erzeugeBrowserLaufzeit({ einschaltung, engine, ladeTurnier }: BrowserLaufzeitDeps): { laufzeit: HallLautsprecherLaufzeit; beenden: () => void } {
  const { turnierId, felder } = einschaltung;
  let lokal: PlanSpiel[] | null = null;
  const turnier = ladeTurnier(turnierId).catch(() => null);
  void turnier.then((t) => {
    lokal = t ? planAusTurnier(t) : null;
  });
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
      leiteIchFeld: (feld) => (ownFieldsByTournament()[turnierId] ?? []).includes(feld),
      eigeneSicht: (matchId) => engine.engine.view(matchId)?.result.state ?? null,
      lokalerSpielplan: () => lokal,
    }),
    uhr: engine.clock,
    uhrProbe: () => ({ wandMs: Date.now(), monoMs: performance.now() }),
    sperre: erzeugeBrowserSperre(),
    kanal,
    wurdeVerworfen: istGeschlafen(),
    gedaechtnisSpeicher: browserKanalSpeicher(),
  });
  let beendet = false;
  void Promise.all([turnier, hallSoundStatus(supabase, { p_tournament_id: turnierId, p_device_id: getDeviceId() })]).then(([t, status]) => {
    const settings = status.ok && status.sicht === 'voll' ? status.settings : null;
    if (!beendet) {
      laufzeit.setzeTonWahl(tonWahlAus(t?.matchCockpitSettings?.soundId, settings, oeffentlicheUrl));
    }
  });
  return {
    laufzeit,
    beenden: () => {
      beendet = true;
      laufzeit.stop();
      kanal.schliessen();
    },
  };
}
