/**
 * Lebenszeichen des leitenden Geräts im Browser (H3b-3, @HT-034, @HT-035, @HT-040, @HT-050): die laufende Instanz dieses Tabs
 * (der unsichtbare Baustein `<HallLautsprecherLaufzeit/>` startet sie für jedes angemeldete Gerät, kein Gast) und ihre
 * Browser-Bausteine. `useHallCockpitHinweis` liest den Stand von hier.
 *
 * „Angepfiffen“ je Feld: ein Spiel des Felds läuft oder ist angehalten – zuerst nach der eigenen Engine (das leitende Gerät
 * hat das Spiel), sonst nach der lokalen Kopie. Welche Spiele auf dem Feld liegen, sagt die lokale Turnierkopie, nur lokal
 * gelesen (`lokalesTurnier.ts`, kein Abgleich mit der Cloud, W2) und höchstens alle 30 s – nur für Turniere mit eigenem Feld.
 * Ohne angepfiffenes Spiel entsteht so keine Anfrage an den Server.
 * N3 (H3b-3): Ändert sich die eigene Engine (Anpfiff, neues Spiel), liest die Leitung die lokale Kopie sofort neu, höchstens
 * einmal je Sekunde – so ist ein Spiel, das noch nicht im gemerkten Plan stand, zum nächsten 5-s-Takt bekannt. Die Engine
 * selbst kennt das Feld ihrer Spiele nicht (`MatchContext` ohne Feld), deshalb bleibt die Kopie die Quelle für das Feld.
 */
import { getDeviceId } from '../../core/device/deviceId';
import { ownFieldsByTournament } from '../../core/fieldControl/ownFields';
import { hallFieldLeadHeartbeat } from '../../core/repositories/hallentonRpc';
import { supabase } from '../../lib/supabase';
import type { Tournament } from '../../types/tournament';
import type { MatchEngineContextValue } from '../match-engine/matchEngineContextInstance';
import { istAngepfiffen, type PlanSpiel } from './runtime/feldStandSpiele';
import { erzeugeLeitungLebenszeichen, type LeitungLebenszeichen } from './runtime/leitungLebenszeichen';
import { planAusTurnier } from './runtime/lokalerSpielplan';
import { echterZeitgeber, type Zeitgeber } from './runtime/zeitgeber';

export const PLAN_NEU_MS = 30_000;
/** N3: nach einer Änderung der eigenen Engine frühestens so lange nach dem letzten Lesen neu lesen (ms). */
export const PLAN_ANSTOSS_MS = 1000;

let leitung: LeitungLebenszeichen | null = null;
const zuhoerer = new Set<() => void>();

export function aktuelleLeitung(): LeitungLebenszeichen | null {
  return leitung;
}

export function setzeLeitung(neu: LeitungLebenszeichen | null): void {
  leitung = neu;
  for (const fn of [...zuhoerer]) {
    fn();
  }
}

export function abonniereLeitung(fn: () => void): () => void {
  zuhoerer.add(fn);
  return () => {
    zuhoerer.delete(fn);
  };
}

export interface BrowserLeitungDeps {
  engine: Pick<MatchEngineContextValue, 'engine'>;
  /** Nur lokal (W2). */
  ladeTurnier: (turnierId: string) => Promise<Tournament | null>;
  /** Für Tests: Server-Aufruf und Zeit. */
  rpc?: typeof hallFieldLeadHeartbeat;
  zeitgeber?: Zeitgeber;
}

export function erzeugeBrowserLeitung({ engine, ladeTurnier, rpc = hallFieldLeadHeartbeat, zeitgeber = echterZeitgeber }: BrowserLeitungDeps): LeitungLebenszeichen {
  const plaene = new Map<string, { plan: PlanSpiel[]; um: number }>();
  const ladend = new Set<string>();

  function lesen(turnierId: string, abstandMs: number): void {
    const alt = plaene.get(turnierId);
    if ((!alt || zeitgeber.jetzt() - alt.um >= abstandMs) && !ladend.has(turnierId)) {
      ladend.add(turnierId);
      void ladeTurnier(turnierId).catch(() => null).then((t) => {
        ladend.delete(turnierId);
        let neu: PlanSpiel[];
        try {
          neu = t ? planAusTurnier(t) : [];
        } catch {
          neu = []; // unlesbare Kopie: kein Feld gilt als angepfiffen
        }
        // auch ohne (lesbare) Kopie gemerkt: erneut erst nach 30 s
        plaene.set(turnierId, { plan: neu, um: zeitgeber.jetzt() });
      });
    }
  }

  function plan(turnierId: string): PlanSpiel[] {
    lesen(turnierId, PLAN_NEU_MS);
    return plaene.get(turnierId)?.plan ?? [];
  }

  const lebenszeichen = erzeugeLeitungLebenszeichen({
    deviceId: getDeviceId(),
    eigeneFelder: ownFieldsByTournament,
    angepfiffen: (turnierId, feld) => plan(turnierId).some((spiel) => spiel.field === feld
      && istAngepfiffen(engine.engine.view(spiel.id)?.result.state.status ?? spiel.status)),
    rpc: (args) => rpc(supabase, args),
    zeitgeber,
  });
  let abmelden: (() => void) | null = null;
  return {
    ...lebenszeichen,
    start() {
      abmelden ??= engine.engine.subscribe(() => {
        for (const turnierId of Object.keys(ownFieldsByTournament())) {
          lesen(turnierId, PLAN_ANSTOSS_MS);
        }
      });
      lebenszeichen.start();
    },
    stop() {
      abmelden?.();
      abmelden = null;
      lebenszeichen.stop();
    },
  };
}
