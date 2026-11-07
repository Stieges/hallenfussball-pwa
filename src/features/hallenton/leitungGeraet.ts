/**
 * Lebenszeichen des leitenden Geräts im Browser (H3b-3, @HT-034, @HT-035, @HT-040, @HT-050): die laufende Instanz dieses Tabs
 * (der unsichtbare Baustein `<HallLautsprecherLaufzeit/>` startet sie für jedes angemeldete Gerät, kein Gast) und ihre
 * Browser-Bausteine. `useHallCockpitHinweis` liest den Stand von hier.
 *
 * „Angepfiffen“ je Feld: ein Spiel des Felds aus der lokalen Turnierkopie (höchstens alle 10 s neu gelesen) läuft oder ist
 * angehalten – nach der eigenen Engine, wo sie das Spiel kennt (das leitende Gerät hat es), sonst nach der lokalen Kopie.
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
import { echterZeitgeber } from './runtime/zeitgeber';

const PLAN_NEU_MS = 10_000;

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
  engine: MatchEngineContextValue;
  ladeTurnier: (turnierId: string) => Promise<Tournament | null>;
}

export function erzeugeBrowserLeitung({ engine, ladeTurnier }: BrowserLeitungDeps): LeitungLebenszeichen {
  const plaene = new Map<string, { plan: PlanSpiel[]; um: number }>();
  const ladend = new Set<string>();

  function plan(turnierId: string): PlanSpiel[] {
    const alt = plaene.get(turnierId);
    if ((!alt || Date.now() - alt.um > PLAN_NEU_MS) && !ladend.has(turnierId)) {
      ladend.add(turnierId);
      void ladeTurnier(turnierId).catch(() => null).then((t) => {
        ladend.delete(turnierId);
        if (t) {
          plaene.set(turnierId, { plan: planAusTurnier(t), um: Date.now() });
        }
      });
    }
    return alt?.plan ?? [];
  }

  return erzeugeLeitungLebenszeichen({
    deviceId: getDeviceId(),
    eigeneFelder: ownFieldsByTournament,
    angepfiffen: (turnierId, feld) => plan(turnierId).some((spiel) => spiel.field === feld
      && istAngepfiffen(engine.engine.view(spiel.id)?.result.state.status ?? spiel.status)),
    rpc: (args) => hallFieldLeadHeartbeat(supabase, args),
    zeitgeber: echterZeitgeber,
  });
}
