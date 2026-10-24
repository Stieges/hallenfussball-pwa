/**
 * Stellt den Tabellen der Turnierverwaltung die Gleichstands-Teile bereit (Paket TB-B, TB-6b): Hinweis je Gruppe und Marke je
 * Zeile. `GroupTables` kennt nur diese beiden Funktionen und bleibt Darstellung (kein Import aus der Turnierverwaltung).
 * Die Sicht je Gruppe wird je Turnier nur einmal gerechnet.
 */
import { useMemo, type ReactNode } from 'react';
import type { Tournament } from '../../../types/tournament';
import { groupTieView, tieMarkerOf, type GroupTieView } from '../../../core/standings/tieViews';
import { TieGroupHint } from './TieGroupHint';
import { TieRowMarker } from './TieRowMarker';

export interface TieRenderers {
  /** Hinweise der Gruppe (`''` bei Jeder gegen jeden). */
  hint: (groupId: string) => ReactNode;
  /** Marke eines Teams in seiner Gruppe. */
  marker: (teamId: string, groupId: string) => ReactNode;
  /** Das Team steht in einem offenen Gleichstand (Marke „Entscheidung nötig“ / „Strafstoßschießen nötig“): keine Medaille für den Platz (@W2A-076). */
  isOpen: (teamId: string, groupId: string) => boolean;
}

export function useTieRenderers(tournament: Tournament): TieRenderers {
  return useMemo(() => {
    const views = new Map<string, GroupTieView>();
    const viewOf = (groupId: string): GroupTieView => {
      let view = views.get(groupId);
      if (view === undefined) {
        view = groupTieView(tournament, groupId);
        views.set(groupId, view);
      }
      return view;
    };
    return {
      hint: (groupId) => <TieGroupHint tournament={tournament} groupId={groupId} />,
      marker: (teamId, groupId) => {
        const marker = tieMarkerOf(viewOf(groupId), teamId);
        return marker === undefined ? null : <TieRowMarker marker={marker} />;
      },
      isOpen: (teamId, groupId) => viewOf(groupId).open.some((block) => block.teamIds.includes(teamId)),
    };
  }, [tournament]);
}
