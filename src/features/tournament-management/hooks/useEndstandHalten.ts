/**
 * useEndstandHalten (B-10a, Befund C-COCKPIT-ENDSTAND-NACH-AUTOENDE): welches abgepfiffene Spiel des Felds das Cockpit noch zeigt.
 *
 * Nach dem Abpfiff bleibt der Endstand 30 Sekunden stehen (@SL-152, @SL-073), bis „Weiter“ getippt wird (@SL-162) oder die 30 Sekunden
 * um sind (@SL-049). Die Frist hängt am Abpfiff-Zeitpunkt in der Engine (`finishedAt`, Serverzeit), nicht an einer eigenen Uhr dieses
 * Geräts: Übernimmt ein zweites Gerät kurz nach dem Abpfiff, sieht es nur den Rest der Frist (@SL-116). Ohne Engine oder ohne Abpfiff-Zeit
 * (ausgefallen, noch nicht beendet) und ohne echten Abpfiff (Direkteintrag im Spielplan) wird nichts gehalten.
 *
 * Korrektur in den 30 Sekunden (@SL-163, @SL-164): Solange die Turnierleitung korrigiert, pausiert die Frist (`pausiere`), das Spiel bleibt
 * stehen, wie lange die Korrektur auch offen ist. Nach Speichern oder Abbruch (`setzeFort`) läuft sie mit der Restzeit beim Öffnen weiter,
 * mindestens 10 Sekunden. „Weiter“ wechselt auch dann sofort.
 */
import { useCallback, useEffect, useState } from 'react';
import type { ScheduledMatch } from '../../../core/generators';
import type { MatchEngine } from '../../../core/match/client';
import type { LiveMatch } from '../../../components/live-cockpit/types';
import { quittungRestOf } from '../../../components/live-cockpit/engine/phaseView';
import { useMatchEngineContextOptional } from '../../match-engine/useMatchEngineContext';

/** Reserve, damit der Wechsel nach dem Ablauf der Frist sicher hinter ihr liegt. */
const NACHLAUF_MS = 50;
/** Mindestzeit, die der Endstand nach einer Korrektur noch steht (@SL-164). */
export const REST_NACH_KORREKTUR_MS = 10_000;

export interface GehaltenesSpiel {
  /** Spiel, dessen Endstand noch steht; `null`, wenn nichts gehalten wird. */
  id: string | null;
  /** Schlüssel von Spiel und Abpfiff-Zeit: ein zweites Ende desselben Spiels ist eine neue Quittung. */
  schluessel: string | null;
  /** Ende der Frist auf der Serverzeit in ms (stabil, solange das Spiel gehalten wird); `null` ohne gehaltenes Spiel oder während der Pause. */
  endeMs: number | null;
}

/**
 * Pause der Frist während einer Korrektur (@SL-163, @SL-164): `restMs` = Restzeit beim Öffnen; `endeMs` = `null`, solange die Korrektur
 * offen ist, danach das neue Ende auf der Serverzeit (Restzeit, mindestens 10 Sekunden ab dem Schließen).
 */
export interface EndstandPause {
  schluessel: string;
  restMs: number;
  endeMs: number | null;
}

const NICHTS: GehaltenesSpiel = { id: null, schluessel: null, endeMs: null };

/** Rein: das zuletzt abgepfiffene Spiel des Felds, dessen 30 Sekunden noch laufen und das nicht quittiert ist. */
export function gehaltenesSpielOf(
  fieldMatches: readonly ScheduledMatch[],
  liveMatches: ReadonlyMap<string, LiveMatch>,
  engine: Pick<MatchEngine, 'view' | 'serverNow'> | null,
  quittiert: readonly string[],
  pause: EndstandPause | null = null,
): GehaltenesSpiel {
  if (!engine) { return NICHTS; }
  const jetzt = engine.serverNow();
  let bestes = NICHTS;
  let bestesEnde = Number.NEGATIVE_INFINITY;
  for (const match of fieldMatches) {
    if (liveMatches.get(match.id)?.status !== 'FINISHED') { continue; }
    const zustand = engine.view(match.id)?.result.state;
    const abpfiff = zustand?.finishedAt ?? null;
    // Nur ein echter Abpfiff (Ablauf, Hand, Strafstoßschießen) setzt `baseDecidedBy`; ein Direkteintrag (RESULT_ENTRY) nicht (S1)
    if (zustand === undefined || abpfiff === null || zustand.baseDecidedBy === null) { continue; }
    const schluessel = `${match.id}@${abpfiff}`;
    // Während einer Korrektur gilt die Frist der Pause statt der 30 Sekunden ab dem Abpfiff (@SL-163, @SL-164)
    const pausiert = pause !== null && pause.schluessel === schluessel;
    const rest = pausiert ? (pause.endeMs === null ? Number.POSITIVE_INFINITY : pause.endeMs - jetzt) : quittungRestOf(zustand, jetzt) ?? 0;
    if (rest <= 0 || quittiert.includes(schluessel) || abpfiff <= bestesEnde) { continue; }
    bestes = { id: match.id, schluessel, endeMs: Number.isFinite(rest) ? jetzt + rest : null };
    bestesEnde = abpfiff;
  }
  return bestes;
}

export interface EndstandHalten {
  gehalten: GehaltenesSpiel;
  /** „Weiter“: das gehaltene Spiel gilt als quittiert und kommt nicht zurück (@SL-162). */
  quittiere: () => void;
  /** Korrektur geöffnet (@SL-163): hält die Frist an, wenn `matchId` das gehaltene Spiel ist; sonst wirkungslos. */
  pausiere: (matchId: string) => void;
  /** Korrektur gespeichert oder abgebrochen (@SL-164): Restzeit beim Öffnen, mindestens 10 Sekunden; ohne Pause wirkungslos. */
  setzeFort: () => void;
}

export function useEndstandHalten(fieldMatches: readonly ScheduledMatch[], liveMatches: ReadonlyMap<string, LiveMatch>): EndstandHalten {
  const engine = useMatchEngineContextOptional()?.engine ?? null;
  const [quittiert, setQuittiert] = useState<readonly string[]>([]);
  // Zähler zum Neurechnen: die Frist läuft ab, ohne dass sich Spiele oder Engine ändern. Er steht auch in den Abhängigkeiten des
  // Timers: Feuert dieser zu früh (Serverzeit wurde in den 30 s zurückgestellt), bleibt der Rest > 0 und ein neuer Timer wird gestellt.
  const [takt, setTakt] = useState(0);
  const [pause, setPause] = useState<EndstandPause | null>(null);

  const gehalten = gehaltenesSpielOf(fieldMatches, liveMatches, engine, quittiert, pause);
  const { id, endeMs } = gehalten;

  useEffect(() => {
    if (id === null || endeMs === null || !engine) { return undefined; }
    const timer = setTimeout(() => { setTakt((n) => n + 1); }, Math.max(0, endeMs - engine.serverNow()) + NACHLAUF_MS);
    return () => { clearTimeout(timer); };
  }, [id, endeMs, engine, takt]);

  const schluessel = gehalten.schluessel;
  const quittiere = useCallback(() => {
    if (schluessel !== null) { setQuittiert((alt) => [...alt, schluessel]); }
  }, [schluessel]);

  const gehaltenId = gehalten.id;
  const pausiere = useCallback((matchId: string) => {
    if (!engine || schluessel === null || gehaltenId !== matchId || endeMs === null) { return; }
    setPause({ schluessel, restMs: Math.max(0, endeMs - engine.serverNow()), endeMs: null });
  }, [engine, schluessel, gehaltenId, endeMs]);
  const setzeFort = useCallback(() => {
    if (!engine) { return; }
    const jetzt = engine.serverNow();
    setPause((alt) => (alt?.endeMs !== null ? alt : { ...alt, endeMs: jetzt + Math.max(alt.restMs, REST_NACH_KORREKTUR_MS) }));
  }, [engine]);

  return { gehalten, quittiere, pausiere, setzeFort };
}
