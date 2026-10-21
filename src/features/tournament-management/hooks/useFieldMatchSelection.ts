/**
 * useFieldMatchSelection – Feld und Spiel im Live-Bereich (Plan LT-2, K4; aus `ManagementTab` ausgelagert).
 *
 * Das Feld steht in der Adresse (`?f=<n>`, URL-ROUTING.md, @OB-030 „Neu laden behält Auswahl“); ungültige Werte gelten als Feld 1.
 * Eine Spielauswahl gibt es nicht mehr (@SL-057): Das Cockpit zeigt das laufende oder das nächste Spiel des Felds; `waehleSpiel`
 * bleibt nur für „Weiter“, das Ende des Spiels und `?matchId=` aus dem Spielplan. `?matchId=` setzt auch das Feld.
 * Nach dem Abpfiff bleibt das Spiel mit dem Endstand 30 Sekunden stehen, bis „Weiter“ kommt (@SL-152, @SL-162, B-10a, `useEndstandHalten`).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { GeneratedSchedule, ScheduledMatch } from '../../../core/generators';
import type { LiveMatch } from '../../../components/live-cockpit/types';
import { matchesOfFieldInPlayOrder } from '../utils/fieldMatchOrder';
import { useEndstandHalten } from './useEndstandHalten';

export interface FieldMatchSelectionParams {
  numberOfFields: number;
  schedule: GeneratedSchedule;
  liveMatches: ReadonlyMap<string, LiveMatch>;
  initialMatchId?: string | null;
  onInitialMatchConsumed?: () => void;
}

export interface FieldMatchSelection {
  feld: number;
  setFeld: (n: number) => void;
  fieldMatches: ScheduledMatch[];
  currentMatchData: ScheduledMatch | undefined;
  /** Das gewählte Spiel zurücksetzen (`null`: automatisch das laufende oder nächste Spiel). */
  waehleSpiel: (id: string | null) => void;
  /** „Weiter“ (@SL-162): das nächste ungespielte Spiel des Felds, sonst das erste ungespielte irgendeines Felds. */
  ladeNaechstes: () => void;
}

const FELD_PARAM = 'f';
const MATCH_PARAM = 'matchId';

export function useFieldMatchSelection(p: FieldMatchSelectionParams): FieldMatchSelection {
  const { numberOfFields, schedule, liveMatches, initialMatchId, onInitialMatchConsumed } = p;
  const [params, setParams] = useSearchParams();
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

  const roh = Number(params.get(FELD_PARAM));
  const feld = Number.isInteger(roh) && roh >= 1 && roh <= Math.max(1, numberOfFields) ? roh : 1;

  const schreibeFeld = useCallback((n: number, ohneMatchId = false) => {
    setParams((alt) => {
      const neu = new URLSearchParams(alt);
      neu.set(FELD_PARAM, String(n));
      if (ohneMatchId) { neu.delete(MATCH_PARAM); }
      return neu;
    }, { replace: true });
  }, [setParams]);

  // Wer das Feld wählt, verwirft ein altes `?matchId=` (sonst springt Neu laden zurück auf dessen Feld, @OB-030)
  const setFeld = useCallback((n: number) => {
    schreibeFeld(n, true);
    setSelectedMatchId(null);
  }, [schreibeFeld]);

  // `?matchId=` aus dem Spielplan („Zum Cockpit“): Feld und Spiel setzen, dann die Kennung verbrauchen. Öffnen beendet nie ein anderes Spiel (@SL-010).
  useEffect(() => {
    if (!initialMatchId) { return; }
    const match = schedule.allMatches.find((m) => m.id === initialMatchId);
    if (match) {
      schreibeFeld(match.field);
      setSelectedMatchId(initialMatchId);
    }
    onInitialMatchConsumed?.();
  }, [initialMatchId, schedule.allMatches, onInitialMatchConsumed, schreibeFeld]);

  const fieldMatches = useMemo(() => matchesOfFieldInPlayOrder(schedule.allMatches, feld), [schedule.allMatches, feld]);

  const { gehalten, quittiere } = useEndstandHalten(fieldMatches, liveMatches);

  // Ein gewähltes Spiel (Spielplan, „Weiter“) gilt nur bis zu seinem Ende: Endet es von selbst oder von Hand, übernimmt der Endstand
  // (30 Sekunden), dann das nächste Spiel (@SL-152, @SL-049). Ein schon beendet geöffnetes Spiel bleibt stehen.
  const warNochNichtBeendet = useRef<string | null>(null);
  useEffect(() => {
    const status = selectedMatchId ? liveMatches.get(selectedMatchId)?.status : undefined;
    if (status === undefined) { return; }
    if (status !== 'FINISHED') { warNochNichtBeendet.current = selectedMatchId; return; }
    if (warNochNichtBeendet.current === selectedMatchId) { warNochNichtBeendet.current = null; setSelectedMatchId(null); }
  }, [selectedMatchId, liveMatches]);

  // Gewählt, sonst läuft ein Spiel, sonst der Endstand des eben abgepfiffenen Spiels, sonst das laufende/geladene, sonst das erste ohne Ergebnis
  const currentMatchData = useMemo((): ScheduledMatch | undefined => {
    if (selectedMatchId) { return fieldMatches.find((m) => m.id === selectedMatchId); }
    const liveStatus = (m: ScheduledMatch): LiveMatch['status'] | undefined => liveMatches.get(m.id)?.status;
    const imGang = fieldMatches.find((m) => liveStatus(m) === 'RUNNING' || liveStatus(m) === 'PAUSED');
    if (imGang) { return imGang; }
    const gehaltenesSpiel = gehalten.id ? fieldMatches.find((m) => m.id === gehalten.id) : undefined;
    if (gehaltenesSpiel) { return gehaltenesSpiel; }
    const geladen = fieldMatches.find((m) => {
      const status = liveStatus(m);
      return status !== undefined && status !== 'FINISHED';
    });
    return geladen ?? fieldMatches.find((m) => m.scoreA === undefined || m.scoreB === undefined);
  }, [selectedMatchId, fieldMatches, liveMatches, gehalten.id]);

  const ladeNaechstes = useCallback(() => {
    quittiere(); // das abgepfiffene Spiel kommt nicht zurück (@SL-162)
    const index = fieldMatches.findIndex((m) => m.id === currentMatchData?.id);
    const naechstes = fieldMatches.slice(index + 1).find((m) => m.scoreA === undefined || m.scoreB === undefined);
    if (naechstes) { setSelectedMatchId(naechstes.id); return; }
    const erstes = schedule.allMatches.find((m) => m.scoreA === undefined || m.scoreB === undefined);
    if (erstes && erstes.field !== feld) {
      schreibeFeld(erstes.field);
      setSelectedMatchId(erstes.id);
    } else {
      setSelectedMatchId(null);
    }
  }, [fieldMatches, currentMatchData, schedule.allMatches, feld, schreibeFeld, quittiere]);

  return { feld, setFeld, fieldMatches, currentMatchData, waehleSpiel: setSelectedMatchId, ladeNaechstes };
}
