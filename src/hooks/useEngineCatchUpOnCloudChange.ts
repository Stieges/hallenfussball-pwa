/**
 * A-08f3b H-1 (Review `task-A-08f3-plan-review-v3.md`): Übernimmt der Feldweg für ein Spiel eine höhere Server-Revision,
 * wird eine schon geladene Engine-Kopie nachgeladen (`catchUp`). Sonst verdeckt die Überlagerung mit der alten Kopie
 * (z. B. nach einem Besuch im Live-Tab) den frischen Stand im Spielplan.
 * Nur für Konten; der Gast hat kein `OfflineRepository` und nichts nachzuladen. `OfflineRepository` kennt die Engine
 * nicht (Layering), deshalb verbindet dieser Hook beide.
 * Anforderungen: @FU-087, @FU-023 (`plattform/2026-09-24_fundament-gemeinsamer-stand.md`).
 */
import { useEffect } from 'react';
import { useMatchEngineContextOptional } from '../features/match-engine/useMatchEngineContext';
import { useServerRevisionSource } from './useServerLedMatchIds';

export function useEngineCatchUpOnCloudChange(tournamentId: string): void {
  const source = useServerRevisionSource();
  const context = useMatchEngineContextOptional();

  useEffect(() => {
    if (!source || !context || context.accountId === 'guest' || !tournamentId) { return undefined; }
    const { engine } = context;
    return source.subscribeServerRevisions(tournamentId, (raised) => {
      for (const matchId of raised) {
        const engineId = matchId.toLowerCase(); // m5: Engine-Schlüssel klein geschrieben
        if (engine.view(engineId) !== null) { void engine.catchUp(engineId); }
      }
    });
  }, [source, context, tournamentId]);
}
