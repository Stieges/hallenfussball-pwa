/**
 * Der Weg zum Spielplan (@ZM-196, @ZM-197, @ZM-175): zwischen dem Kopfblock und dem ersten Spiel stehen nur drei schmale Zeilen –
 * „Mein Team“ (ohne Wahl eine Zeile, mit Wahl der Block), die Filterzeile (Gruppen-Auswahl und Taste „Filter“) und die eingeklappten
 * Teilnehmer – dazu bei gesetztem Filter die Hinweiszeile. Das Blatt „Filter“ und die Team-Auswahl öffnen von hier.
 */
import { useState } from 'react';
import type { ReactElement } from 'react';
import type { TournamentView } from '../../../core/view';
import type { Standing, Tournament } from '../../../types/tournament';
import { hiddenFilterKeys } from '../publicFilterState';
import { myTeamFacts } from '../publicMyTeamFacts';
import { myTeamName, uniqueGroups, type PhaseFilter, type StatusFilter, type ViewFilters } from '../publicScheduleFilters';
import { PublicFilterNote } from './PublicFilterNote';
import { PublicFilterRow } from './PublicFilterRow';
import { PublicFilterSheet } from './PublicFilterSheet';
import { PublicMyTeam } from './PublicMyTeam';
import { PublicParticipants } from './PublicParticipants';
import { TeamSelectorDialog } from './TeamSelectorDialog';

export interface PublicWegBlockProps {
  tournament: Tournament;
  view: TournamentView;
  standings: Standing[];
  filters: ViewFilters;
  showTeamSelector: boolean;
  onShowTeamSelector: (show: boolean) => void;
  onSelectTeam: (teamId: string | null) => void;
  onGroupChange: (group: string | null) => void;
  onPhaseChange: (phase: PhaseFilter) => void;
  onStatusChange: (status: StatusFilter) => void;
  onResetHidden: () => void;
  onOnlyMineChange: (value: boolean) => void;
}

export function PublicWegBlock(p: PublicWegBlockProps): ReactElement {
  const [sheetOpen, setSheetOpen] = useState(false);
  const groups = uniqueGroups(p.tournament);
  const teamName = myTeamName(p.tournament, p.filters.myTeamId);
  const facts = p.filters.myTeamId === null || teamName === null
    ? {}
    : myTeamFacts({ view: p.view, standings: p.standings, teamId: p.filters.myTeamId, groupCount: groups.length });
  const keys = hiddenFilterKeys(p.filters);
  // Phase nur anbieten, wenn es eine Finalrunde gibt (@ZM-196: Nikolaus ohne Phasen-Filter)
  const hasFinals = p.view.matches.some((m) => m.phase === 'final');
  return (
    <div data-testid="public-weg">
      <PublicMyTeam teamName={teamName} facts={facts} onOpenSelector={() => p.onShowTeamSelector(true)} onlyMine={p.filters.showOnlyMyTeam} onOnlyMineChange={p.onOnlyMineChange} />
      <PublicFilterRow groups={groups} selectedGroup={p.filters.selectedGroup} hiddenCount={keys.length} sheetOpen={sheetOpen} onGroupChange={p.onGroupChange} onOpenSheet={() => setSheetOpen(true)} />
      <PublicParticipants teams={p.tournament.teams} />
      <PublicFilterNote keys={keys} onShowAll={p.onResetHidden} />
      <PublicFilterSheet
        isOpen={sheetOpen}
        showPhase={hasFinals}
        selectedPhase={p.filters.selectedPhase}
        selectedStatus={p.filters.selectedStatus}
        onPhaseChange={p.onPhaseChange}
        onStatusChange={p.onStatusChange}
        onReset={p.onResetHidden}
        onClose={() => setSheetOpen(false)}
      />
      {p.showTeamSelector && (
        <TeamSelectorDialog teams={p.tournament.teams} myTeamId={p.filters.myTeamId} onSelectTeam={p.onSelectTeam} onClose={() => p.onShowTeamSelector(false)} />
      )}
    </div>
  );
}
