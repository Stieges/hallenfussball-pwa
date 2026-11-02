/**
 * MatchProtocolSheet (@SL-193, Befund C-PROTOKOLL-OHNE-EINSTIEG, @FU-080, @FU-082): „Protokoll ansehen“ am Spiel – dieselbe
 * Protokoll-Liste wie im Cockpit (`EventLogBottomSheet`), nur lesend. Die Ereignisse kommen aus `useLiveMatches` mit der
 * Kennung des Turniers; die Komponente steht nur, solange das Blatt offen ist (kein Abonnement im Ruhezustand).
 */
import { useLiveMatches } from '../../../hooks/useLiveMatches';
import { EventLogBottomSheet } from '../../live-cockpit/components/EventLogBottomSheet';

export interface MatchProtocolSheetProps {
  tournamentId: string;
  matchId: string;
  home: { id: string; name: string };
  away: { id: string; name: string };
  onClose: () => void;
}

export function MatchProtocolSheet({ tournamentId, matchId, home, away, onClose }: MatchProtocolSheetProps) {
  const { liveMatches } = useLiveMatches(tournamentId);
  const live = liveMatches.get(matchId);
  return (
    <EventLogBottomSheet
      isOpen
      onClose={onClose}
      events={live?.events ?? []}
      homeTeamName={live?.homeTeam.name ?? home.name}
      awayTeamName={live?.awayTeam.name ?? away.name}
      homeTeamId={live?.homeTeam.id ?? home.id}
      awayTeamId={live?.awayTeam.id ?? away.id}
      matchId={matchId}
    />
  );
}
