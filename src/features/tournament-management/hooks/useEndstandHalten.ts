/**
 * useEndstandHalten (B-10a, Befund C-COCKPIT-ENDSTAND-NACH-AUTOENDE): welches abgepfiffene Spiel des Felds das Cockpit noch zeigt.
 *
 * Nach dem Abpfiff bleibt der Endstand 30 Sekunden stehen (@SL-152, @SL-073), bis „Weiter“ getippt wird (@SL-162) oder die 30 Sekunden
 * um sind (@SL-049). Die Frist hängt am Abpfiff-Zeitpunkt in der Engine (`finishedAt`, Serverzeit), nicht an einer eigenen Uhr dieses
 * Geräts: Übernimmt ein zweites Gerät kurz nach dem Abpfiff, sieht es nur den Rest der Frist (@SL-116). Ohne Engine oder ohne Abpfiff-Zeit
 * (ausgefallen, noch nicht beendet) wird nichts gehalten.
 */
import { useCallback, useEffect, useState } from 'react';
import type { ScheduledMatch } from '../../../core/generators';
import type { MatchEngine } from '../../../core/match/client';
import type { LiveMatch } from '../../../components/live-cockpit/types';
import { quittungRestOf } from '../../../components/live-cockpit/engine/phaseView';
import { useMatchEngineContextOptional } from '../../match-engine/useMatchEngineContext';

/** Reserve, damit der Wechsel nach dem Ablauf der Frist sicher hinter ihr liegt. */
const NACHLAUF_MS = 50;

export interface GehaltenesSpiel {
  /** Spiel, dessen Endstand noch steht; `null`, wenn nichts gehalten wird. */
  id: string | null;
  /** Schlüssel von Spiel und Abpfiff-Zeit: ein zweites Ende desselben Spiels ist eine neue Quittung. */
  schluessel: string | null;
  /** Ende der Frist auf der Serverzeit in ms (stabil, solange das Spiel gehalten wird); `null` ohne gehaltenes Spiel. */
  endeMs: number | null;
}

const NICHTS: GehaltenesSpiel = { id: null, schluessel: null, endeMs: null };

/** Rein: das zuletzt abgepfiffene Spiel des Felds, dessen 30 Sekunden noch laufen und das nicht quittiert ist. */
export function gehaltenesSpielOf(
  fieldMatches: readonly ScheduledMatch[],
  liveMatches: ReadonlyMap<string, LiveMatch>,
  engine: Pick<MatchEngine, 'view' | 'serverNow'> | null,
  quittiert: readonly string[],
): GehaltenesSpiel {
  if (!engine) { return NICHTS; }
  const jetzt = engine.serverNow();
  let bestes = NICHTS;
  let bestesEnde = Number.NEGATIVE_INFINITY;
  for (const match of fieldMatches) {
    if (liveMatches.get(match.id)?.status !== 'FINISHED') { continue; }
    const zustand = engine.view(match.id)?.result.state;
    const abpfiff = zustand?.finishedAt ?? null;
    if (zustand === undefined || abpfiff === null) { continue; }
    const rest = quittungRestOf(zustand, jetzt) ?? 0;
    const schluessel = `${match.id}@${abpfiff}`;
    if (rest <= 0 || quittiert.includes(schluessel) || abpfiff <= bestesEnde) { continue; }
    bestes = { id: match.id, schluessel, endeMs: jetzt + rest };
    bestesEnde = abpfiff;
  }
  return bestes;
}

export interface EndstandHalten {
  gehalten: GehaltenesSpiel;
  /** „Weiter“: das gehaltene Spiel gilt als quittiert und kommt nicht zurück (@SL-162). */
  quittiere: () => void;
}

export function useEndstandHalten(fieldMatches: readonly ScheduledMatch[], liveMatches: ReadonlyMap<string, LiveMatch>): EndstandHalten {
  const engine = useMatchEngineContextOptional()?.engine ?? null;
  const [quittiert, setQuittiert] = useState<readonly string[]>([]);
  // Zähler nur zum Neurechnen: die Frist läuft ab, ohne dass sich Spiele oder Engine ändern
  const [, setTakt] = useState(0);

  const gehalten = gehaltenesSpielOf(fieldMatches, liveMatches, engine, quittiert);
  const { id, endeMs } = gehalten;

  useEffect(() => {
    if (id === null || endeMs === null || !engine) { return undefined; }
    const timer = setTimeout(() => { setTakt((n) => n + 1); }, Math.max(0, endeMs - engine.serverNow()) + NACHLAUF_MS);
    return () => { clearTimeout(timer); };
  }, [id, endeMs, engine]);

  const schluessel = gehalten.schluessel;
  const quittiere = useCallback(() => {
    if (schluessel !== null) { setQuittiert((alt) => [...alt, schluessel]); }
  }, [schluessel]);

  return { gehalten, quittiere };
}
