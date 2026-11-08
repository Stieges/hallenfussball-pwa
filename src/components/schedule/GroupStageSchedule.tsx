/**
 * GroupStageSchedule - Displays group stage matches in MeinTurnierplan style
 * Fully responsive with table view for desktop and card view for mobile
 *
 * US-SCHEDULE-EDITOR: Now supports Drag & Drop for match swapping in edit mode
 */

import { CSSProperties, useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { cssVars, spacingSemantics, mediaQueries } from '../../design-tokens'
import { ScheduledMatch } from '../../core/generators';
import { RefereeConfig, RuntimeMatchEvent } from '../../types/tournament';
import type { ScheduleSource } from './scheduleSource';
import { getGroupShortCode } from '../../utils/displayNames';
import { buildSideContext, matchHeading, matchViewOf, sideDisplay, sideName } from './matchSides';
import { MatchForfeitAction, type MatchForfeitActions } from './MatchForfeitAction';
import { cardStatusOf, resultFigures } from './matchResult';
import type { MatchView, SpectatorClock } from '../../core/view';
import {
  MatchCard,
  type MatchCardStatus,
  type RefereeOption,
} from './MatchCard';
import { QuickScoreExpand, LiveInfoExpand, StartMatchExpand, SummaryExpand } from './MatchExpand';
import { useMatchConflictsFromTournament, type ConflictSource } from '../../features/schedule-editor/hooks/useMatchConflicts';
import type { LiveMatch } from '../live-cockpit/types';
import { NO_LIVE_MATCHES } from './noLiveMatches';
import { SortableMobileCard } from './SortableMobileCard';
import { SortableDesktopCard } from './SortableDesktopCard';
import { DesktopCard } from './DesktopCard';
import { SCHEDULE_AUTO_SCROLL, useScheduleDrag } from './useScheduleDrag';
import { useRefereeChoices } from './refereeChoices';
import { useMatchActionMenu } from './actionMenu/useMatchActionMenu';
import type { MatchActionRights } from './actionMenu/matchActions';
import { Versus } from '../ui/atoms';

// Pending changes during edit mode
interface PendingChanges {
  refereeAssignments: Record<string, number | null>;
  fieldAssignments: Record<string, number>;
}

interface GroupStageScheduleProps {
  matches: ScheduledMatch[];
  hasGroups: boolean;
  refereeConfig?: RefereeConfig;
  numberOfFields?: number;
  onRefereeChange?: (matchId: string, refereeNumber: number | null) => void;
  onFieldChange?: (matchId: string, fieldNumber: number) => void;
  onScoreChange?: (matchId: string, scoreA: number, scoreB: number) => void;
  editable?: boolean;
  /** Is the schedule currently being edited (edit mode active) */
  editingSchedule?: boolean;
  /** Pending changes during edit mode (not yet saved) */
  pendingChanges?: PendingChanges;
  /** Rechte der Turnierleitung bzw. des Helfers; mit ihnen öffnet der Tipp auf ein Spiel die Aktionsauswahl (@SL-193) */
  actionRights?: MatchActionRights;
  /** „Ergebnis korrigieren“: derselbe Dialog wie im Cockpit (@EK-063) */
  onCorrect?: (matchId: string) => void;
  /** Gespielte Sekunden eines laufenden Spiels (Kopfzeile der Karte, @OB-064); ohne Angabe steht nur „läuft“ */
  /** Restzeit eines laufenden Spiels (`useSpectatorClocks`, @ZM-162); ohne Angabe keine Uhr */
  clockOf?: (matchId: string) => SpectatorClock | null;
  /** Teams, Gruppen, Spiele und die gemeinsame Ansicht (Status, Seiten, Endstand) */
  tournament?: ScheduleSource;
  /** Live-Daten mit Ereignissen (ein Abonnement in `ScheduleDisplay`, geteilt mit dem Protokoll der Aktionsauswahl) */
  liveMatches?: ReadonlyMap<string, LiveMatch>;
  /**
   * Turnierdaten für die Konflikterkennung im Bearbeitungsmodus. Ohne Angabe gibt es keine Konflikt-Markierung
   * (ScheduleDisplay kennt weder Spieldauer noch Pause und gibt sie nicht an).
   */
  conflictSource?: ConflictSource;
  /** US-SCHEDULE-EDITOR: Callback when matches are swapped via DnD */
  onMatchSwap?: (matchId1: string, matchId2: string) => boolean;
  /** Callback to navigate to cockpit with selected match */
  onNavigateToCockpit?: (matchId: string) => void;
  /** B-12: „Nicht angetreten“ / „Wertung zurücknehmen“ (nur Turnierleitung); ohne Angabe keine Taste */
  forfeit?: MatchForfeitActions;
  /** Whether to show the section title (default: true) */
  showTitle?: boolean;
  /** Spiel beenden (@FU-112): die Turnierleitung darf ein laufendes Spiel im Spielplan beenden (sonst nicht angeboten, @FU-113). */
  canEndRunning?: boolean;
  // Note: Permission check is now handled in ScheduleTab
}

export const GroupStageSchedule: React.FC<GroupStageScheduleProps> = ({
  matches,
  hasGroups,
  refereeConfig,
  numberOfFields = 1,
  onRefereeChange,
  onFieldChange,
  onScoreChange,
  editable: _editable = false,
  editingSchedule = false,
  pendingChanges,
  actionRights,
  onCorrect,
  clockOf,
  tournament,
  liveMatches = NO_LIVE_MATCHES,
  conflictSource,
  onMatchSwap,
  onNavigateToCockpit,
  forfeit,
  showTitle = true,
  canEndRunning = false,
}) => {
  const { t } = useTranslation('tournament');
  // Ziehen/Tauschen (@ZP-100): Liste nach Uhrzeit, Tausch über onMatchSwap (Entwurf)
  const { sensors, sortedMatches, activeMatch, handleDragStart, handleDragEnd, handleDragCancel } = useScheduleDrag(matches, onMatchSwap);
  // Schiedsrichter-Auswahl aus einer Quelle (Teams pfeifen: Teamnamen, @W3-011)
  const refereeChoiceList = useRefereeChoices(refereeConfig, tournament?.teams);

  // Spielplan 2.0: Expand state for mobile cards
  type ExpandType = 'quick' | 'live' | 'start' | 'summary' | null;
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [expandType, setExpandType] = useState<ExpandType>(null);

  // Close expand when pressing Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && expandedMatchId) {
        setExpandedMatchId(null);
        setExpandType(null);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [expandedMatchId]);

  // Close expand when clicking outside (Mobile UX improvement)
  useEffect(() => {
    if (!expandedMatchId) { return; }

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      // Check if click is outside any MatchCard. Der Pfad steht beim Auslösen fest: Hat React den angeklickten Knopf
      // beim Umschalten schon aus der Seite genommen (z. B. „Spiel beenden und Ergebnis eintragen“), findet
      // `closest` am abgetrennten Knoten keine Karte mehr (@FU-112).
      const clickedCard = e.composedPath().some((n) => n instanceof Element && n.hasAttribute('data-match-card'))
        || target.closest('[data-match-card]');
      if (!clickedCard) {
        setExpandedMatchId(null);
        setExpandType(null);
      }
    };

    // Use setTimeout to avoid closing on the same click that opened
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('touchend', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('touchend', handleClickOutside);
    };
  }, [expandedMatchId]);

  // Conflict detection for edit mode
  const { getMatchConflicts } = useMatchConflictsFromTournament(
    conflictSource ?? null,
    editingSchedule // Only detect when in edit mode
  );

  // ============================================================================
  // Spielplan 2.0: Helper functions for MatchCard integration
  // ============================================================================

  /**
   * Convert match state to MatchCardStatus
   */
  const view = tournament?.view;
  const getMatchStatus = useCallback(
    (match: ScheduledMatch): MatchCardStatus => cardStatusOf(view?.byId.get(match.id)),
    [view],
  );

  // Kästen in Teamfarbe (Weste bei Leibchen) nur beim laufenden und beim nächsten Spiel des Felds (@ZM-158); nie im Kindermodus ohne Stand
  const nextIds = useMemo(() => {
    const ids = new Set<string>();
    for (const field of new Set(matches.map((m) => m.field))) {
      const next = view?.currentFor(field).next;
      if (next !== undefined) { ids.add(next.id); }
    }
    return ids;
  }, [view, matches]);
  const kastenOf = (matchId: string): MatchView['boxes'] | undefined => {
    const shown = view?.byId.get(matchId);
    return view?.rules.results === true && shown !== undefined && (shown.isLive || nextIds.has(matchId)) ? shown.boxes : undefined;
  };

  // Spielseiten: Namen immer aus der Ansicht (Slots, aktuelle Teams; @TM-015), nie aus gespeichertem Anzeigetext
  const sides = useMemo(() => buildSideContext(tournament, matches), [tournament, matches]);

  // Eine Tippfläche je Spiel (Karte und Tore): die Aktionsauswahl (@SL-193); „Ergebnis eintragen“ öffnet die Schnelleingabe der Karte
  const openQuickEntry = useCallback((matchId: string) => { setExpandedMatchId(matchId); setExpandType('quick'); }, []);
  const menu = useMatchActionMenu({
    rights: actionRights, liveMatches, matches, sides, numberOfFields, refereeChoices: refereeChoiceList,
    onEnterResult: onScoreChange ? openQuickEntry : undefined, onNavigateToCockpit, onCorrect, onRefereeChange, onFieldChange, forfeit,
  });

  /*
   * Handle card body click - opens QuickScore expand for non-live matches
   */
  const handleCardClick = (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) { return; }
    if (menu.enabled) { menu.open(matchId); return; }

    const status = getMatchStatus(match);

    // UX-FIX: Public View Hardening
    // If not editable (Spectator) and match is scheduled, ignore click.
    if (!_editable && status === 'scheduled') {
      return;
    }

    if (status === 'running') {
      // Live matches: Show hint that score is managed in cockpit
      // For now, show LiveInfoExpand
      setExpandedMatchId(matchId);
      setExpandType('live');
      return;
    }

    // UX-FIX: Public View - Finished matches show Summary
    if (!_editable && status === 'finished') {
      if (expandedMatchId === matchId && expandType === 'summary') {
        setExpandedMatchId(null);
        setExpandType(null);
      } else {
        setExpandedMatchId(matchId);
        setExpandType('summary');
      }
      return;
    }

    // Toggle expand for non-live matches (Admin: QuickScore)
    if (expandedMatchId === matchId && expandType === 'quick') {
      setExpandedMatchId(null);
      setExpandType(null);
    } else {
      setExpandedMatchId(matchId);
      setExpandType('quick');
    }
  };

  /**
   * Handle circle click - status-specific action
   */
  const handleCircleClick = (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) { return; }
    if (menu.enabled) { menu.open(matchId); return; }

    const status = getMatchStatus(match);

    // UX-FIX: Public View Hardening
    // If not editable (Spectator) and match is scheduled, ignore click.
    if (!_editable && status === 'scheduled') {
      return;
    }

    switch (status) {
      case 'scheduled':
        // Not started: Show start confirmation
        setExpandedMatchId(matchId);
        setExpandType('start');
        break;
      case 'running':
        // Live: Show live info with link to cockpit
        setExpandedMatchId(matchId);
        setExpandType('live');
        break;
      case 'finished':
        // Finished: Show match summary with events (inline)
        setExpandedMatchId(matchId);
        setExpandType('summary');
        break;
      default:
        // Ausgefallen: kein Ergebnis, nichts zu öffnen
        break;
    }
  };

  /**
   * Handle score save from expand
   */
  const handleExpandSave = useCallback((matchId: string, homeScore: number, awayScore: number) => {
    // Beendete Spiele öffnen hier nie die Schnelleingabe: ihre Korrektur beginnt in der Aktionsauswahl (@EK-063)
    onScoreChange?.(matchId, homeScore, awayScore);
    setExpandedMatchId(null);
    setExpandType(null);
  }, [onScoreChange]);

  /**
   * Handle expand cancel/close
   */
  const handleExpandClose = useCallback(() => {
    setExpandedMatchId(null);
    setExpandType(null);
  }, []);

  /**
   * Navigate to cockpit for a match
   * TODO: Implement actual navigation via context or URL params
   * The actual navigation should be handled by a callback prop (onNavigateToCockpit)
   */
  const handleNavigateToCockpit = useCallback((matchId: string) => {
    // Close the expand
    setExpandedMatchId(null);
    setExpandType(null);
    // Navigate to cockpit if callback provided
    onNavigateToCockpit?.(matchId);
  }, [onNavigateToCockpit]);

  /**
   * Unified render function for expand content (used by both mobile and desktop)
   */
  const renderExpandContent = useCallback((match: ScheduledMatch): React.ReactNode => {
    if (expandedMatchId !== match.id || !expandType) {
      return null;
    }

    const homeTeam = sideDisplay(match, 'A', sides);
    const awayTeam = sideDisplay(match, 'B', sides);
    // „Nicht angetreten“ steht in der Aktionsauswahl (@SL-193); die Taste in den Feldern der Karte nur ohne Auswahl
    const forfeitAction = menu.enabled ? undefined : <MatchForfeitAction matchId={match.id} viewStatus={matchViewOf(sides, match.id)?.status} forfeit={forfeit} />;

    switch (expandType) {
      case 'quick':
        return (
          <QuickScoreExpand
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            homeScore={match.scoreA ?? 0}
            awayScore={match.scoreB ?? 0}
            onSave={(home, away) => handleExpandSave(match.id, home, away)}
            onCancel={handleExpandClose}
            extraAction={forfeitAction}
          />
        );
      case 'live': {
        const liveMatch = liveMatches.get(match.id);
        const sourceEvents = match.events ?? liveMatch?.events;

        // Flatten events for LiveInfoExpand (expects params at top level, not in payload)
        const events = sourceEvents?.map((e: RuntimeMatchEvent) => ({
          ...e,
          ...e.payload, // Flatten payload
          matchId: e.matchId ?? match.id,
        })) ?? [];

        return (
          <LiveInfoExpand
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            homeScore={match.scoreA ?? 0}
            awayScore={match.scoreB ?? 0}
            clock={clockOf?.(match.id) ?? null}
            badge={matchViewOf(sides, match.id)?.badge}
            events={events}
            onNavigateToCockpit={_editable ? () => handleNavigateToCockpit(match.id) : undefined}
            onEndAndEnter={_editable && canEndRunning && onScoreChange ? () => setExpandType('quick') : undefined}
            onClose={handleExpandClose}
          />
        );
      }
      case 'start':
        return (
          <StartMatchExpand
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            matchNumber={match.matchNumber}
            scheduledTime={match.time}
            field={match.field}
            onConfirm={() => handleNavigateToCockpit(match.id)}
            onCancel={handleExpandClose}
            extraAction={forfeitAction}
          />
        );
      case 'summary': {
        // Get events for summary
        const liveMatch = liveMatches.get(match.id);
        const liveEvents = liveMatch?.events;
        const sourceEvents = match.events ?? liveEvents;
        const events: RuntimeMatchEvent[] = sourceEvents
          ? (sourceEvents).map(e => ({
            ...e,
            matchId: e.matchId ?? match.id,
            scoreAfter: e.scoreAfter,
          }))
          : [];

        return (
          <SummaryExpand
            homeTeamName={homeTeam.name}
            awayTeamName={awayTeam.name}
            homeScore={match.scoreA ?? 0}
            awayScore={match.scoreB ?? 0}
            homeTeamId={homeTeam.id}
            awayTeamId={awayTeam.id}
            events={events} // Pass events
            onClose={handleExpandClose}
            extraAction={forfeitAction}
          />
        );
      }
      default:
        return null;
    }
  }, [expandedMatchId, expandType, handleExpandClose, handleExpandSave, handleNavigateToCockpit, sides, liveMatches, clockOf, _editable, canEndRunning, onScoreChange, forfeit, menu.enabled]);

  if (matches.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: `${cssVars.spacing.xl} ${cssVars.spacing.md}`,
        color: cssVars.colors.textSecondary,
        fontSize: cssVars.fontSizes.lg
      }}>
        {t('groupStage.noMatches')}
      </div>
    );
  }

  const showReferees = !!(refereeConfig && refereeConfig.mode !== 'none');
  const showFields = numberOfFields > 1;
  // Hide group label for single-group tournaments (or when no groups defined)
  const showGroupLabel = (tournament?.groups?.length ?? 0) > 1;

  const refereeOptions = refereeConfig ? refereeChoiceList : [];

  // Generate field options for dropdown
  const getFieldOptions = () => {
    const options = [];
    for (let i = 1; i <= numberOfFields; i++) {
      options.push({ value: i, label: i.toString() });
    }
    return options;
  };

  const fieldOptions = getFieldOptions();

  // Auswahl der Karte am Handy: „Kein SR“ + dieselben Einträge wie überall
  const editableRefereeOptions: RefereeOption[] = [{ value: null, label: t('groupStage.noReferee') }, ...refereeOptions];

  // Styles
  const containerStyle: CSSProperties = {
    marginBottom: cssVars.spacing.lg,
  };

  const titleStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xl,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.primary,
    marginBottom: cssVars.spacing.md,
  };

  // Render desktop card list (non-edit mode)
  const renderDesktopCardContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: cssVars.spacing.xs }}>
      {sortedMatches.map((match) => {
        const status = getMatchStatus(match);
        const isExpanded = expandedMatchId === match.id;

        // Check if match has events (from persisted or live data)
        const liveMatch = liveMatches.get(match.id);
        const hasEvents = (match.events?.length ?? 0) > 0 || (liveMatch?.events.length ?? 0) > 0;

        return (
          <DesktopCard
            key={match.id}
            match={match}
            status={status}
            isExpanded={isExpanded}
            tournament={tournament}
            sideContext={sides}
            showGroupLabel={showGroupLabel}
            onCardClick={handleCardClick}
            onCircleClick={handleCircleClick}
            renderExpandContent={renderExpandContent}
            hasEvents={hasEvents}
            clock={clockOf?.(match.id) ?? null}
          />
        );
      })}
    </div>
  );

  // Render desktop cards for edit mode (with DnD support)
  const renderDesktopEditContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: cssVars.spacing.xs }}>
      {sortedMatches.map((match) => {
        const status = getMatchStatus(match);

        // Get pending changes for edit mode
        const hasPendingRef = pendingChanges?.refereeAssignments[match.id] !== undefined;
        const displayedRef = hasPendingRef
          ? pendingChanges.refereeAssignments[match.id]
          : match.referee;
        const hasPendingField = pendingChanges?.fieldAssignments[match.id] !== undefined;
        const displayedField = hasPendingField
          ? pendingChanges.fieldAssignments[match.id]
          : match.field;
        const hasUnsavedChanges = hasPendingRef || hasPendingField;

        return (
          <SortableDesktopCard
            key={match.id}
            match={match}
            status={status}
            displayedRef={displayedRef}
            displayedField={displayedField}
            hasUnsavedChanges={hasUnsavedChanges}
            hasPendingRef={hasPendingRef}
            hasPendingField={hasPendingField}
            conflicts={getMatchConflicts(match.id)}
            editingSchedule={editingSchedule}
            canSwap={!!onMatchSwap}
            tournament={tournament}
            sideContext={sides}
            showGroupLabel={showGroupLabel}
            showReferees={showReferees}
            refereeOptions={refereeOptions}
            showFields={showFields}
            fieldOptions={fieldOptions}
            onRefereeChange={onRefereeChange}
            onFieldChange={onFieldChange}
          />
        );
      })}
    </div>
  );

  return (
    <div style={containerStyle} className="group-stage-schedule">
      {showTitle && (
        <h2 style={titleStyle}>
          {hasGroups ? t('groupStage.title') : t('groupStage.scheduleTitle')}
        </h2>
      )}

      {/* Desktop View - Card layout (normal) or Card edit mode */}
      {editingSchedule && onMatchSwap ? (
        /* Edit Mode: Desktop cards with DnD, conflict display, and inline editing */
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          autoScroll={SCHEDULE_AUTO_SCROLL}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="desktop-view">
            <SortableContext
              items={sortedMatches.map(m => m.id)}
              strategy={verticalListSortingStrategy}
            >
              {renderDesktopEditContent()}
            </SortableContext>
          </div>

          {/* Desktop Drag Overlay - Compact row preview */}
          <DragOverlay dropAnimation={null}>
            {activeMatch && (
              <div style={{
                backgroundColor: cssVars.colors.surface,
                boxShadow: `0 8px 24px ${cssVars.colors.surfaceDark}`,
                borderRadius: cssVars.borderRadius.md,
                border: `3px solid ${cssVars.colors.primary}`,
                padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
                display: 'flex',
                alignItems: 'center',
                gap: cssVars.spacing.md,
                minWidth: spacingSemantics.dialogSm,
                maxWidth: spacingSemantics.dialogXl,
                cursor: 'grabbing',
              }}>
                <span style={{ color: cssVars.colors.primary, fontSize: cssVars.fontSizes.lg }}>⋮⋮</span>
                <span style={{ fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary }}>
                  {activeMatch.time}
                </span>
                <span style={{ fontWeight: cssVars.fontWeights.bold, flex: 1 }}>
                  {sideName(activeMatch, 'A', sides)}
                  <span style={{ color: cssVars.colors.textMuted, padding: `0 ${cssVars.spacing.sm}` }}><Versus /></span>
                  {sideName(activeMatch, 'B', sides)}
                </span>
                {hasGroups && (
                  <span style={{
                    backgroundColor: cssVars.colors.primary,
                    color: cssVars.colors.background,
                    padding: `2px ${cssVars.spacing.sm}`,
                    borderRadius: cssVars.borderRadius.sm,
                    fontSize: cssVars.fontSizes.xs,
                    fontWeight: cssVars.fontWeights.semibold,
                  }}>
                    {activeMatch.group ? getGroupShortCode(activeMatch.group, tournament) : '-'}
                  </span>
                )}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      ) : (
        /* Normal Mode: MatchCardDesktop with expand functionality (no DnD needed) */
        <div className="desktop-view">
          {renderDesktopCardContent()}
        </div>
      )}

      {/* Mobile Card View - Spielplan 2.0 with MatchCard */}
      {editingSchedule && onMatchSwap ? (
        /* Edit Mode: Mobile cards with DnD */
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          autoScroll={SCHEDULE_AUTO_SCROLL}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="mobile-view">
            <SortableContext
              items={sortedMatches.map(m => m.id)}
              strategy={verticalListSortingStrategy}
            >
              {sortedMatches.map((match) => {
                const status = getMatchStatus(match);
                const isExpanded = expandedMatchId === match.id;

                // Get pending changes for edit mode
                const hasPendingRef = pendingChanges?.refereeAssignments[match.id] !== undefined;
                const displayedRef = hasPendingRef
                  ? pendingChanges.refereeAssignments[match.id]
                  : match.referee;
                const hasPendingField = pendingChanges?.fieldAssignments[match.id] !== undefined;
                const displayedField = hasPendingField
                  ? pendingChanges.fieldAssignments[match.id]
                  : match.field;
                const hasUnsavedChanges = hasPendingRef || hasPendingField;

                return (
                  <SortableMobileCard
                    key={match.id}
                    match={match}
                    status={status}
                    isExpanded={isExpanded}
                    displayedRef={displayedRef}
                    displayedField={displayedField}
                    hasUnsavedChanges={hasUnsavedChanges}
                    hasPendingField={hasPendingField}
                    conflicts={getMatchConflicts(match.id)}
                    editingSchedule={editingSchedule}
                    canSwap={!!onMatchSwap}
                    tournament={tournament}
                    sideContext={sides}
                    showGroupLabel={showGroupLabel}
                    showReferees={showReferees}
                    refereeOptions={editableRefereeOptions}
                    showFields={showFields}
                    fieldOptions={fieldOptions}
                    onRefereeChange={onRefereeChange}
                    onFieldChange={onFieldChange}
                    onCardClick={handleCardClick}
                    onCircleClick={handleCircleClick}
                    renderExpandContent={renderExpandContent}
                  />

                );
              })}
            </SortableContext>
          </div>

          {/* Mobile Drag Overlay */}
          <DragOverlay dropAnimation={null}>
            {activeMatch && (
              <div style={{
                backgroundColor: cssVars.colors.surface,
                boxShadow: `0 8px 24px ${cssVars.colors.surfaceDark}`,
                borderRadius: cssVars.borderRadius.md,
                border: `3px solid ${cssVars.colors.primary}`,
                padding: cssVars.spacing.md,
                display: 'flex',
                alignItems: 'center',
                gap: cssVars.spacing.sm,
                minWidth: '280px',
                maxWidth: '100%',
                cursor: 'grabbing',
                height: '100%', // Match height
                boxSizing: 'border-box'
              }}>
                <span style={{ color: cssVars.colors.primary, fontSize: cssVars.fontSizes.lg }}>⋮⋮</span>
                <span style={{ fontWeight: cssVars.fontWeights.bold, color: cssVars.colors.primary }}>
                  #{activeMatch.matchNumber}
                </span>
                <span style={{ color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm }}>
                  {activeMatch.time}
                </span>
                <span style={{ fontWeight: cssVars.fontWeights.semibold, flex: 1, fontSize: cssVars.fontSizes.sm }}>
                  {sideName(activeMatch, 'A', sides)} <span style={{ color: cssVars.colors.textMuted }}><Versus /></span> {sideName(activeMatch, 'B', sides)}
                </span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      ) : (
        /* Normal Mode: Standard MatchCards without DnD */
        <div className="mobile-view">
          {sortedMatches.map((match) => {
            const status = getMatchStatus(match);
            const isExpanded = expandedMatchId === match.id;

            // Check if match has events (from persisted or live data)
            const liveMatch = liveMatches.get(match.id);
            const hasEvents = (match.events?.length ?? 0) > 0 || (liveMatch?.events.length ?? 0) > 0;

            const cardProps = {
              matchId: match.id,
              matchNumber: match.matchNumber,
              scheduledTime: match.time,
              field: match.field,
              group: matchHeading(match, sides) ?? (match.group ? getGroupShortCode(match.group, tournament) : undefined),
              showGroupLabel,
              homeTeam: sideDisplay(match, 'A', sides),
              awayTeam: sideDisplay(match, 'B', sides),
              result: resultFigures(matchViewOf(sides, match.id)?.score, status),
              status: status,
              viewStatus: matchViewOf(sides, match.id)?.status,
              badge: matchViewOf(sides, match.id)?.badge,
              clock: clockOf?.(match.id) ?? null,
              kasten: kastenOf(match.id),
            };

            return (
              <div key={match.id} style={{ marginBottom: cssVars.spacing.sm }}>
                <MatchCard
                  {...cardProps}
                  onCardClick={() => handleCardClick(match.id)}
                  onCircleClick={() => handleCircleClick(match.id)}
                  isExpanded={isExpanded}
                  expandContent={renderExpandContent(match)}
                  referee={match.referee ? String(match.referee) : undefined}
                  hasEvents={hasEvents}
                />
              </div>
            );
          })}
        </div>
      )}

      {menu.element}

      <style>{`
        /* Hide mobile view by default */
        .group-stage-schedule .mobile-view {
          display: none;
        }

        /* Mobile: Show cards, hide table */
        ${mediaQueries.tabletDown} {
          .group-stage-schedule .desktop-view {
            display: none;
          }
          .group-stage-schedule .mobile-view {
            display: block;
          }
        }

        /* Tablet: Keep table but adjust sizing */
        @media (min-width: 768px) and (max-width: 1024px) {
          .group-stage-schedule table {
            font-size: 12px;
          }
          .group-stage-schedule th,
          .group-stage-schedule td {
            padding: 8px 6px;
          }
        }

        /* Print: Always use table layout */
        @media print {
          .group-stage-schedule {
            break-inside: avoid;
          }
          .group-stage-schedule .mobile-view {
            display: none !important;
          }
          .group-stage-schedule .desktop-view {
            display: block !important;
          }
          .group-stage-schedule table {
            min-width: 100%;
          }
        }
      `}</style>
    </div>
  );
};
