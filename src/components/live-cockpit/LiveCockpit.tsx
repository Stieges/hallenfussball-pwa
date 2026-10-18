/**
 * LiveCockpit - Live Match Control Interface
 *
 * A touch-optimized interface for tournament directors to manage live matches.
 * Features: Timer, Score Control, Event Tracking, Fouls, Cards, Substitutions.
 *
 * Hülle (Scheibe 1): bindet Bereichs-Hooks an Bereiche. Befehle und Effekte stehen in
 * `hooks/useCockpitCommands.ts`, Darstellung in `areas/`, Stile in `LiveCockpitShell.module.css`.
 *
 * Layout:
 * - Desktop: Main grid (scoreboard + sidebar)
 * - Mobile: Stacked layout with bottom footer
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useBreakpoint, useMatchTimerExtended, useMatchSound } from '../../hooks';
import { useFoulCounts } from '../../hooks/useFoulCounts';
import { useFoulThresholdWarning } from '../../hooks/useFoulThresholdWarning';
import { SyncStatusIndicator } from '../../features/collaboration';
import { OutboxNotice } from '../../features/collaboration/outbox/OutboxNotice';
import { useOutboxStatus } from '../../features/collaboration/outbox/useOutboxStatus';
import { useRejectedOutboxDialog } from '../../features/collaboration/outbox/useRejectedOutboxDialog';
import { useMatchEngineContextOptional } from '../../features/match-engine/useMatchEngineContext';
import { getEffectiveScore } from '../../utils/matchScore';
import type { SperrHinweis } from '../../core/match';
import type { LiveCockpitProps } from './types';
import { DEFAULT_MATCH_COCKPIT_SETTINGS } from '../../types/tournament';
import { ScoreboardArea } from './areas/ScoreboardArea';
import { LegacyPlayArea } from './areas/LegacyPlayArea';
import { CockpitOverlays } from './areas/CockpitOverlays';
import shell from './LiveCockpitShell.module.css';
import { useCockpitPhase, useEntryFlows, useSideOrder } from './hooks';
import { useEnginePhase } from './hooks/useEnginePhase';
import { legacyPhaseViewOf } from './model/legacyPhaseView';
import { istAngepfiffenUndNichtBeendet } from './model/cockpitPhase';
import { useCockpitNotices } from './hooks/useCockpitNotices';
import { useCockpitCommands } from './hooks/useCockpitCommands';
import { useTeamColumns } from './hooks/useTeamColumns';
import { usePenaltyExpiryNotice } from './hooks/usePenaltyExpiryNotice';
import { alsUebersetzer } from './model/alsUebersetzer';

const NO_SPERREN: readonly SperrHinweis[] = [];

export const LiveCockpit: React.FC<LiveCockpitProps> = (props) => {
  const { fieldName, tournamentName, tournamentId, cockpitSettings: cockpitSettingsProp, readOnly = false, currentMatch, upcomingMatches, leer = null } = props;
  const { t } = useTranslation('cockpit');

  // W1 (Nachtrag C3a-2a): nur einbinden -- OutboxNotice rendert selbst nichts, solange kein
  // Ausgangs-Zustand vorliegt (kind === null).
  const matchEngineContext = useMatchEngineContextOptional();
  const outboxStatus = useOutboxStatus(matchEngineContext?.sender ?? null);
  const handleOutboxReload = useCallback(() => window.location.reload(), []);

  // Einstellungen mit Vorgaben, Ton für das Ende, Gerätetyp
  const cockpitSettings = useMemo(() => ({ ...DEFAULT_MATCH_COCKPIT_SETTINGS, ...cockpitSettingsProp }), [cockpitSettingsProp]);
  const sound = useMatchSound(cockpitSettings.soundId, cockpitSettings.soundVolume, cockpitSettings.soundEnabled, tournamentId);
  const { breakpoint, isMobile, isTablet } = useBreakpoint();

  const flows = useEntryFlows(currentMatch?.id);
  // Seiten tauschen: nur die Anzeige dieses Geräts (@SL-065)
  const sides = useSideOrder(currentMatch);
  const notices = useCockpitNotices(); // Meldezeile statt Toast (Spec § 7)

  // C3b-2b (G11): Foul-Zaehler aus den FOUL-Eintraegen in `events` -- ganzes Spiel, kein
  // Halbzeit-Reset, kein lokales +1 (zurueckgenommenes zaehlt nicht, G6/RC13).
  const { home: homeFouls, away: awayFouls } = useFoulCounts(currentMatch);
  // M7: 5-Fouls-Warnung als Effekt auf den Zaehler -- einmal je Team beim Erreichen von 5.
  useFoulThresholdWarning(
    { home: homeFouls, away: awayFouls },
    { home: currentMatch?.homeTeam.name ?? '', away: currentMatch?.awayTeam.name ?? '' },
    (teamName, count) => { notices.melde(2, t('meldung.foulGrenze', { teamName, count })); }, currentMatch?.id,
  );

  // I4 (W1, Nachtrag Fixrunde 1): Ablehnungen (D-C1) auch für Helfer im Cockpit sichtbar.
  const rejectedOutbox = useRejectedOutboxDialog(tournamentId, notices.fehler);

  // BUG-004 FIX: Echtzeit-Uhr; hier nur noch für das Zeit-Blatt (die Tafel liest `PhaseView`, das Ende von selbst `useAutoSectionEnd`)
  const { displaySeconds, elapsedSeconds } = useMatchTimerExtended(
    currentMatch?.timerStartTime ?? null,
    currentMatch?.timerElapsedSeconds ?? 0,
    currentMatch?.status ?? 'NOT_STARTED',
    currentMatch?.durationSeconds ?? 900, // Default 15 min if missing
    cockpitSettings.timerDirection,
    cockpitSettings.nettoWarningSeconds,
  );

  // Zustand der Tafel: Engine-Ansicht, ohne Engine-Kopie die Zeit aus dem `LiveMatch`
  const engineView = useEnginePhase(currentMatch?.id ?? '');
  const view = useMemo(
    () => engineView ?? (currentMatch ? legacyPhaseViewOf(currentMatch, elapsedSeconds) : null),
    [engineView, currentMatch, elapsedSeconds],
  );
  const phase = useCockpitPhase(currentMatch, view, currentMatch ? null : leer);
  // Nur im angepfiffenen Spiel: vor dem Anpfiff und ohne Spiel hat das Abzeichen keine Wirkung, der Anpfiff-Tipp gibt den Ton frei
  const tonHinweis = cockpitSettings.soundEnabled && !sound.isActivated && istAngepfiffenUndNichtBeendet(phase.zustand)
    ? { label: t('tafel.tonAusAntippen'), kurz: t('tafel.tonAus'), onAntippen: () => { void sound.activate(); } }
    : null;

  const cmd = useCockpitCommands({
    props, settings: cockpitSettings, sound, flows, sides, melde: notices.melde, engineView,
  });
  const foulsJeSeite = useMemo(() => ({ home: homeFouls, away: awayFouls }), [homeFouls, awayFouls]);
  const anzeigeOrdnung = useMemo(() => ({ links: sides.links, rechts: sides.rechts }), [sides.links, sides.rechts]);
  const spalten = useTeamColumns({
    match: currentMatch, view, phase, settings: cockpitSettings, kannSteuern: !readOnly, fouls: foulsJeSeite,
    sperrHinweise: props.sperrHinweise ?? NO_SPERREN, order: anzeigeOrdnung, handlers: cmd.teamHandlers,
  });
  const teams = useMemo(() => (currentMatch ? { home: currentMatch.homeTeam, away: currentMatch.awayTeam } : null), [currentMatch]);
  usePenaltyExpiryNotice(currentMatch?.id, view, teams, notices.melde, alsUebersetzer(t));

  // Tafel: mit Spiel und ohne (wartet auf Teams, kein Spiel mehr). Die Verbindungsanzeige steht bis zum schmalen Kopf (3.8) darin.
  const tafel = (
    <ScoreboardArea
      match={currentMatch}
      phase={phase}
      view={view}
      settings={cockpitSettings}
      order={{ links: sides.links, rechts: sides.rechts }}
      size={isMobile ? 'compact' : isTablet ? 'regular' : 'wide'}
      notices={notices}
      eintraegeWarten={rejectedOutbox.pendingCount}
      tonHinweis={tonHinweis}
      fieldName={fieldName}
      tournamentName={tournamentName}
      leer={leer}
      mindestpause={props.mindestpause}
      sperrHinweise={props.sperrHinweise}
      uebernahmeVon={props.uebernahmeVon}
      // A4 (C-SYNC): rendert selbst nichts außerhalb des Cloud-Modus. I4 (W1, Nachtrag
      // Fixrunde 1): rejectedCount/reviewCount aus dem echten Sender (useEngineOutboxSummary).
      sync={
        <SyncStatusIndicator
          tournamentId={tournamentId}
          compact
          rejectedCount={rejectedOutbox.rejectedCount}
          reviewCount={rejectedOutbox.reviewCount}
          onShowRejected={rejectedOutbox.show}
          enginePendingCount={rejectedOutbox.pendingCount}
        />
      }
    />
  );

  if (!currentMatch) {
    if (leer) {
      return (
        <div className={shell.container}>
          <main className={isMobile ? `${shell.content} ${shell.contentMobile}` : shell.content}>{tafel}</main>
        </div>
      );
    }
    return (
      <div className={shell.empty}>
        <p className={shell.emptyText}>{t('leer.keinSpielGewaehlt')}</p>
      </div>
    );
  }

  const match = currentMatch;
  if (!spalten) { return null; } // nie: ohne Spiel (spalten === null) kehrt die Hülle oben zurück
  // Task R2: readOnly kommt aus einer echten Berechtigungsprüfung (ManagementTab.checkCanEditMatch
  // → canEditResults), das beendete Spiel ist die bestehende "Spiel ist vorbei"-Sperre. Beide
  // führen zu "keine Bedienung", aber nur `readOnly` zeigt das Berechtigungs-Banner.
  const isLocked = readOnly || match.status === 'FINISHED';
  const effectiveScore = getEffectiveScore(match);

  return (
    <div className={shell.container}>
      <main className={isMobile ? `${shell.content} ${shell.contentMobile}` : shell.content}>
        {tafel}

        {/* Task R2: Read-Only-Banner — nur bei fehlender Berechtigung (readOnly), nicht bei beendetem Spiel allein. */}
        {readOnly && (
          <div className={shell.readOnlyBanner} data-testid="cockpit-readonly-banner" role="status">
            {t('readOnly.banner')}
          </div>
        )}

        {/* W1 (Nachtrag C3a-2a): rendert selbst nichts, solange kein Ausgangs-Zustand
            (clientOutdated/authRequired/notReady/review) vorliegt. */}
        <OutboxNotice status={outboxStatus} matchId={match.id} onReload={handleOutboxReload} />

        <LegacyPlayArea
          match={match}
          nextMatch={upcomingMatches.length > 0 ? upcomingMatches[0] : null}
          breakpoint={breakpoint}
          isMobile={isMobile}
          isDesktop={!isMobile && !isTablet}
          isLocked={isLocked}
          columns={spalten}
          controls={cmd.controls}
          sidebar={{ activePenalties: cmd.activePenalties, onEventEdit: cmd.onSidebarEventEdit }}
        />
      </main>

      <CockpitOverlays
        match={match}
        tournamentId={tournamentId}
        readOnly={readOnly}
        isLocked={isLocked}
        settings={cockpitSettings}
        displaySeconds={displaySeconds}
        effectiveScore={effectiveScore}
        dialogs={cmd.dialogs}
        editingEvent={cmd.editingEvent}
        editing={cmd.editing}
        handlers={cmd.overlayHandlers}
        rejectedOutbox={rejectedOutbox}
      />
    </div>
  );
};

export default LiveCockpit;
