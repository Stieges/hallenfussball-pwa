/**
 * loadEngineEventsForExport (C3b-2 F3b2, M8/U1): EIN Lauf beim Klick auf "Exportieren" --
 * `ensureMatch` fuer alle Spiele, Sammelabfrage (W3), `markEngineMatches`, `catchUpLoaded`, dann
 * framework-frei die nicht zurueckgenommenen Ereignisse lesen (`computeLiveMatches` ->
 * `toLiveMatchView`). KEIN Dauer-Abo -- ersetzt `useEngineEventsById.ts` (zweite
 * `useEngineMatches`-Instanz, die bei jedem Oeffnen der Exporte ein eigenes Abo anstiess, s.
 * Review M8). Ein Export-Klick vor dem Laden lieferte dort still ohne Engine-Ereignisse; dieser
 * Lauf wird stattdessen VOM Export-Klick selbst ausgeloest und wartet, bis er fertig ist.
 *
 * Fehlerpolitik (U1, Kickoff; Ruling PC31):
 * - Gast-Konto (`accountId === 'guest'`, wie `MatchEngine.runCatchUp`): KEINE Sammelabfrage, kein
 *   catch-up -- ein Gast hat keine Server-Ereignisse, der Export laeuft rein lokal (auch offline).
 * - Angemeldet: JEDER Fehler im Lauf bricht den Export ab, kein stiller Teil-Export. Das gilt auch
 *   fuer ein gescheitertes catch-up: `engine.catchUpLoaded()` verschluckt Fehler (setzt nur
 *   `engine.status(matchId).lastError`), deshalb wird danach `lastError` der in diesem Lauf
 *   nachgeladenen Spiele geprueft und als Fehler geworfen. Der Aufrufer (Exports/index.tsx) faengt ihn ueber den
 *   bestehenden `exportError`-Pfad.
 */
import type { Tournament, RuntimeMatchEvent } from '../../types/tournament';
import type { LiveMatch } from '../../core/models/LiveMatch';
import type { MatchEngineContextValue } from './matchEngineContextInstance';
import { buildValidMatches, computeLiveMatches } from '../../hooks/engineMatchModel';
import { fetchEngineMatchIds, type EngineMatchIdsQueryClient } from './fetchEngineMatchIds';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';

/** Gleiche Prüfung wie `useEngineMatches.ts` -- Nicht-UUID-Spiel-IDs können serverseitig keine
 * Engine-Ereignisse haben (die FK-Spalte ist `uuid`), eine ungueltige Eingabe wuerde die ganze
 * Sammelabfrage zum Scheitern bringen. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(matchId: string): boolean {
  return UUID_PATTERN.test(matchId);
}

export async function loadEngineEventsForExport(
  tournament: Tournament,
  context: MatchEngineContextValue,
): Promise<ReadonlyMap<string, RuntimeMatchEvent[]>> {
  const { engine } = context;
  const validMatches = buildValidMatches(tournament);

  for (const entry of validMatches) {
    await engine.ensureMatch(entry.matchId, entry.ctx, tournament.id);
  }

  let engineMatchIds = new Set<string>();
  const isGuest = context.accountId === 'guest';
  if (!isGuest && isSupabaseConfigured && supabase) {
    const client: unknown = supabase;
    engineMatchIds = await fetchEngineMatchIds(
      client as EngineMatchIdsQueryClient,
      validMatches.map((entry) => entry.matchId).filter(isUuid),
    );
    // Genau die Spiele, die `catchUpLoaded` in DIESEM Lauf nachlaedt (`MatchEngine.qualifiesForCatchUp`):
    // vom Server gemeldet (`engineMatchIds`) ODER lokal schon Ereignisse (`view.log.length > 0` ist
    // gleichbedeutend mit "pending/acked/confirmed nicht leer"). Die Menge wird VOR dem Nachladen
    // bestimmt, denn das Nachladen kann lokale Ereignisse erst erzeugen. Ein alter, tolerierter
    // `lastError` eines nicht nachgeladenen Spiels (z. B. `useEngineMatchReadiness`) bleibt ohne Wirkung.
    const caughtUpIds = validMatches
      .map((entry) => entry.matchId)
      .filter((matchId) => engineMatchIds.has(matchId) || (engine.view(matchId)?.log.length ?? 0) > 0);
    engine.markEngineMatches(engineMatchIds);
    await engine.catchUpLoaded();
    for (const matchId of caughtUpIds) {
      const { lastError } = engine.status(matchId);
      if (lastError !== null) {
        throw new Error(`Nachladen der Spielereignisse fehlgeschlagen (Spiel ${matchId}): ${lastError}`);
      }
    }
  }

  const noLocalLiveMatches = new Map<string, LiveMatch>();
  const liveMatches = computeLiveMatches(context, validMatches, engineMatchIds, tournament, noLocalLiveMatches);

  const map = new Map<string, RuntimeMatchEvent[]>();
  for (const [matchId, match] of liveMatches) {
    if (match.events.length > 0) {
      map.set(matchId, match.events);
    }
  }
  return map;
}
