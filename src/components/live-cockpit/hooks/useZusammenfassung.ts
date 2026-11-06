/**
 * useZusammenfassung – nach dem Abpfiff statt der Tastenblöcke die Zusammenfassung je Team (@SL-048, @SL-115).
 * Liest nur die Einträge des Spiels; nach dem Neuladen steht sie wieder da. Aus `LiveCockpit.tsx` ausgelagert (Zeilengrenze).
 */
import { useMemo } from 'react';
import { toTeamSummaryModel, type TeamSummaryModel } from '../model/toTeamSummaryModel';
import type { CockpitZustand } from '../model/cockpitPhase';
import type { Side } from '../model/cockpitTypes';
import type { LiveMatch } from '../types';
import type { CockpitKasten } from '../typesFarben';

export function useZusammenfassung(
  match: LiveMatch | null, zustand: CockpitZustand, fouls: Record<Side, number>, order: { links: Side; rechts: Side }, kasten: CockpitKasten,
): { links: TeamSummaryModel; rechts: TeamSummaryModel } | null {
  return useMemo(() => {
    if (!match || zustand !== 'abgepfiffen') { return null; }
    const je = (seite: Side) => toTeamSummaryModel({ match, seite, fouls: fouls[seite], kasten: kasten[seite] });
    return { links: je(order.links), rechts: je(order.rechts) };
  }, [match, zustand, fouls, order.links, order.rechts, kasten]);
}
