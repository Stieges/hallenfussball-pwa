import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { displayFontSizes, displaySpacing, monitorThemes } from '../../../design-tokens';
import type { Tournament } from '../../../types/tournament';
import type { TournamentView } from '../../../core/view';
import type { MonitorSlide, MonitorTheme, PerformanceSettings } from '../../../types/monitor';
import { LiveMatchDisplay } from '../../../components/monitor';
import { fieldIdToNumber, resolveTheme } from '../monitorDisplayHelpers';
import { toLiveMatch } from '../monitorMatch';
import { MonitorTimeNotes } from '../components/MonitorTimeCell';

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
}

export function LiveSlide({ slide, tournament, view, theme, style, pinnedMatchId }: LiveSlideProps) {
  const { t } = useTranslation('monitor');
  const resolvedTheme = resolveTheme(theme);
  const themeColors = monitorThemes[resolvedTheme];

  const fieldNumber = fieldIdToNumber(slide.config.fieldId);
  const fieldConfig = tournament.fields?.find(f => f.id === slide.config.fieldId);
  const fieldName = fieldConfig?.customName ?? fieldConfig?.defaultName ?? t('fieldSelector.field', { field: fieldNumber });
  const { matches, teams } = tournament;

  // Gepinntes Spiel (@ZM-075/077), sonst das laufende Spiel auf diesem Feld (Halbzeit zählt mit): `isLive` der Ansicht
  const field = view.currentFor(fieldNumber);
  const shown = (pinnedMatchId ? view.byId.get(pinnedMatchId) : undefined) ?? field.live[0];
  const runningMatch = shown === undefined ? undefined : matches.find(m => m.id === shown.id);

  // Nächstes offenes Spiel dieses Feldes, in Anpfiff-Reihenfolge (B-16f2, C-MON-NAECHSTES-UNSORTIERT); nie ein
  // laufendes oder unterbrochenes Spiel (@ZM-041)
  const nextMatch = !runningMatch ? field.next : undefined;

  // Delegate to LiveMatchDisplay for running matches
  if (runningMatch && shown) {
    const liveMatch = toLiveMatch(shown, runningMatch, teams, tournament);
    // B-44a4 (@ME-020): Die Folie ist Größen-Container; die Live-Anzeige misst an ihrer Fläche innerhalb des Bildrands
    return (
      <div style={{ ...style, containerType: 'size' }} data-testid="live-slide-area">
        <LiveMatchDisplay
          match={liveMatch}
          group={runningMatch.group}
          fullscreen
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
  const whenIdleType = slide.config.whenIdle?.type ?? 'next-match';

  // Vor dem Anpfiff (@ZM-195, @ZM-138): die Live-Folie zeigt das nächste Spiel in denselben Kästen wie im Spiel (0 : 0, Farbe = Trikot bzw. Ausweichfarbe,
  // ein festgelegtes Leibchen als Weste), die Anstoßzeit an der Stelle der Uhr; Initialen-Kreise folgen mit dem Neubau der Kästen (#418)
  const nextRaw = nextMatch === undefined ? undefined : matches.find(m => m.id === nextMatch.id);
  if (whenIdleType !== 'skip' && nextMatch && nextRaw) {
    return (
      <div style={{ ...style, containerType: 'size' }} data-testid="next-slide-area">
        <LiveMatchDisplay
          match={toLiveMatch(nextMatch, nextRaw, teams, tournament)}
          group={nextRaw.group}
          fullscreen
          theme={theme}
          boxes={nextMatch.boxes}
          hideScore={!view.rules.results}
          badge={{ kind: 'next' }}
          kickoff={nextMatch.kickoff ? { time: nextMatch.kickoff.time, notes: <MonitorTimeNotes match={nextMatch} color={themeColors.text} testIdPrefix="monitor-next" /> } : undefined}
        />
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
