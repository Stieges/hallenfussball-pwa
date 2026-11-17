import type { ComponentProps, CSSProperties, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, displayFontSizes, displayHall, displaySpacing, monitorThemes } from '../../../design-tokens';
import type { Tournament } from '../../../types/tournament';
import type { TournamentView } from '../../../core/view';
import type { MonitorProfile, MonitorSlide, MonitorTheme, PerformanceSettings } from '../../../types/monitor';
import { LiveMatchDisplay } from '../../../components/monitor';
import { HallMatchDisplay } from '../../../components/monitor/hall';
import { resolveTheme } from '../monitorDisplayHelpers';
import { liveSlideState } from './liveSlideState';
import { toLiveMatch } from '../monitorMatch';
import { MonitorTimeNotes } from '../components/MonitorTimeCell';

/** Die bisherige Live-Folie füllt den Größen-Container (`fullscreen`); gleiche Eigenschaften wie `HallMatchDisplay`. */
function FullscreenLiveMatchDisplay(props: ComponentProps<typeof HallMatchDisplay>): ReactElement {
  return <LiveMatchDisplay {...props} fullscreen />;
}

/** Satz „Auf Feld 1 folgt heute kein Spiel mehr“ im Profil „Halle (sehr fern)“ */
const hallNoMatchStyle = (color: string): CSSProperties => ({
  boxSizing: 'border-box',
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: `0 ${displayHall.noMatch.padX}`,
  textAlign: 'center',
  fontSize: displayHall.noMatch.font,
  fontWeight: cssVars.fontWeights.bold,
  color,
});

interface LiveSlideProps {
  slide: MonitorSlide;
  tournament: Tournament;
  /** Die gemeinsame Ansicht des Monitors (A-36c) */
  view: TournamentView;
  performanceSettings: PerformanceSettings;
  theme: MonitorTheme;
  style: CSSProperties;
  /** Gepinntes Spiel (B-16e1): bleibt bis zum Ende der Haltezeit sichtbar, auch mit Endstand. */
  pinnedMatchId?: string | null;
  /** Darstellungsprofil des Monitors (@ZM-212): „Halle (sehr fern)“ zeigt die Anordnung „Farbseiten“, sonst die bisherige Folie */
  profile?: MonitorProfile;
}

export function LiveSlide({ slide, tournament, view, theme, style, pinnedMatchId, profile }: LiveSlideProps) {
  const { t } = useTranslation('monitor');
  const resolvedTheme = resolveTheme(theme);
  const themeColors = monitorThemes[resolvedTheme];

  const hall = profile === 'hall-very-far';
  // Profil „Halle (sehr fern)“: nach dem Abschluss bleibt das zuletzt beendete Spiel des Felds mit „Endstand“ stehen (@ZM-212), nie die Abschluss-Liste
  const { fieldName, shown, runningMatch, nextMatch, nextRaw } = liveSlideState(slide, tournament, view, pinnedMatchId, t, hall && tournament.lifecycleStatus === 'finished');
  const { teams } = tournament;
  // Beide Anordnungen nehmen dieselben Daten; die Fassung für die Hallentiefe braucht kein `fullscreen`
  const Display = hall ? HallMatchDisplay : FullscreenLiveMatchDisplay;
  // @ZM-215 (nur Profil „Halle (sehr fern)“): Feld und Gruppe stehen im Band nur, wenn das Turnier mehr als eins davon hat
  const hallAngaben = hall
    ? { showField: (tournament.fields?.length ?? tournament.numberOfFields) > 1, showGroup: (tournament.groups?.length ?? tournament.numberOfGroups ?? 1) > 1 }
    : {};

  // Delegate to LiveMatchDisplay (bzw. im Profil „Halle (sehr fern)“ an HallMatchDisplay) for running matches
  if (runningMatch && shown) {
    const liveMatch = toLiveMatch(shown, runningMatch, teams, tournament);
    // B-44a4 (@ME-020): Die Folie ist Größen-Container; die Live-Anzeige misst an ihrer Fläche innerhalb des Bildrands
    return (
      <div style={{ ...style, containerType: 'size' }} data-testid="live-slide-area">
        <Display
          {...hallAngaben}
          match={liveMatch}
          group={runningMatch.group}
          theme={theme}
          boxes={shown.boxes}
          hideScore={!view.rules.results}
          finalScore={shown.score}
          finalRound={shown.phase === 'final'}
          badge={shown.badge}
          // R5 PR 2: Uhr aus der Ansicht und dem Feinstatus (Serverzeit), nicht aus der Spieldauer (C-MONITOR-OHNE-ABSCHNITTE)
          uhr={{
            match: shown, liveState: runningMatch.liveState, timerStartTime: runningMatch.timerStartTime,
            timerElapsedSeconds: runningMatch.timerElapsedSeconds, steht: shown.status === 'paused',
          }}
          // @ZM-182/@ZM-192: laufende Zeitstrafen aus den öffentlichen Ereignissen (ohne „Ereignisse je Spiel“ liefert der Server keine)
          // @ZM-194: ist der Live-Stand aus, fehlen die Tore -- dann zeigt der Monitor keine Zeitstrafe (der Kreis würde ein Tor verraten)
          zeitstrafenQuelle={view.rules.liveScore ? { events: runningMatch.events, liveState: runningMatch.liveState } : undefined}
        />
      </div>
    );
  }

  // No live match - show next match or idle state based on whenIdle config
  // Profil „Halle (sehr fern)“: die Folie bleibt zwischen den Spielen stehen und zeigt das nächste Spiel (@ZM-212), nie die Folie überspringen
  const whenIdleType = hall ? 'next-match' : slide.config.whenIdle?.type ?? 'next-match';

  // Vor dem Anpfiff (@ZM-195, @ZM-138): die Live-Folie zeigt das nächste Spiel in denselben Kästen wie im Spiel (0 : 0, Farbe = Trikot bzw. Ausweichfarbe,
  // ein festgelegtes Leibchen als Weste), die Anstoßzeit an der Stelle der Uhr; Initialen-Kreise folgen mit dem Neubau der Kästen (#418)
  if (whenIdleType !== 'skip' && nextMatch && nextRaw) {
    return (
      <div style={{ ...style, containerType: 'size' }} data-testid="next-slide-area">
        <Display
          {...hallAngaben}
          match={toLiveMatch(nextMatch, nextRaw, teams, tournament)}
          group={nextRaw.group}
          theme={theme}
          boxes={nextMatch.boxes}
          hideScore={!view.rules.results}
          badge={{ kind: 'next' }}
          kickoff={nextMatch.kickoff ? { time: nextMatch.kickoff.time, notes: <MonitorTimeNotes match={nextMatch} color={themeColors.text} testIdPrefix="monitor-next" /> } : undefined}
        />
      </div>
    );
  }

  if (hall) {
    // Folgt kein Spiel mehr auf dem Feld (@ZM-212): ein Satz, groß und mittig
    return (
      <div style={{ ...style, containerType: 'size' }} data-testid="hall-no-match-area">
        <div data-testid="hall-no-match" data-monitor="uhr" style={hallNoMatchStyle(themeColors.text)}>
          {t('slides.live.hallNoMoreMatch', { field: fieldName })}
        </div>
      </div>
    );
  }

  return (
    <div style={style}>
      <div style={{
        fontSize: displayFontSizes.headingMD,
        color: themeColors.textSecondary,
        marginBottom: displaySpacing.sectionMD,
      }}>
        {fieldName}
      </div>

      {whenIdleType === 'skip' ? (
        <div style={{
          fontSize: displayFontSizes.bodyLG,
          color: themeColors.textMuted,
        }}>
          {t('slides.live.idleSkip')}
        </div>
      ) : (
        <div style={{
          fontSize: displayFontSizes.bodyLG,
          color: themeColors.textMuted,
        }}>
          {t('slides.live.noMatch')}
        </div>
      )}
    </div>
  );
}
