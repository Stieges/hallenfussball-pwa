import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, displayFontSizes, displaySpacing, monitorThemes } from '../../../design-tokens';
import type { Tournament } from '../../../types/tournament';
import type { MonitorSlide, MonitorTheme, PerformanceSettings } from '../../../types/monitor';
import { TeamAvatar } from '../../../components/ui/TeamAvatar';
import { LiveMatchDisplay } from '../../../components/monitor';
import { fieldIdToNumber, resolveTheme } from '../monitorDisplayHelpers';
import { isMatchInProgress } from '../slideProgramme';
import { scoresPublic } from '../publicVisibility';
import { toLiveMatch } from '../monitorMatch';
import { sideLabel, sideTeam } from '../matchSides';
import { upcomingMatches } from '../slideContent';
import { formatTime } from '../../../core/generators/scheduleHelpers';

interface LiveSlideProps {
  slide: MonitorSlide;
  tournament: Tournament;
  performanceSettings: PerformanceSettings;
  theme: MonitorTheme;
  style: CSSProperties;
  /** Gepinntes Spiel (B-16e1): bleibt bis zum Ende der Haltezeit sichtbar, auch mit Endstand. */
  pinnedMatchId?: string | null;
}

export function LiveSlide({ slide, tournament, theme, style, pinnedMatchId }: LiveSlideProps) {
  const { t } = useTranslation('monitor');
  const resolvedTheme = resolveTheme(theme);
  const themeColors = monitorThemes[resolvedTheme];

  const fieldNumber = fieldIdToNumber(slide.config.fieldId);
  const field = tournament.fields?.find(f => f.id === slide.config.fieldId);
  const fieldName = field?.customName ?? field?.defaultName ?? t('fieldSelector.field', { field: fieldNumber });
  const { matches, teams } = tournament;

  // Gepinntes Spiel (@ZM-075/077), sonst das laufende Spiel auf diesem Feld (Halbzeit zählt mit)
  const pinnedMatch = pinnedMatchId ? matches.find(m => m.id === pinnedMatchId) : undefined;
  const runningMatch = pinnedMatch ?? matches.find(
    m => m.field === fieldNumber && isMatchInProgress(m)
  );

  // Nächstes offenes Spiel dieses Feldes, in Anpfiff-Reihenfolge (B-16f2, C-MON-NAECHSTES-UNSORTIERT)
  const nextMatch = !runningMatch
    ? upcomingMatches(matches, { count: 1, field: fieldNumber })[0]
    : undefined;
  const labelCtx = { teams, matches, groups: tournament.groups, hidePendingOrigin: !scoresPublic(tournament) };

  // Delegate to LiveMatchDisplay for running matches
  if (runningMatch) {
    const liveMatch = toLiveMatch(runningMatch, teams, tournament);
    // B-44a4 (@ME-020): Die Folie ist Größen-Container; die Live-Anzeige misst an ihrer Fläche innerhalb des Bildrands
    return (
      <div style={{ ...style, containerType: 'size' }} data-testid="live-slide-area">
        <LiveMatchDisplay
          match={liveMatch}
          group={runningMatch.group}
          fullscreen
          theme={theme}
          colorScheme={slide.config.liveColorScheme}
          hideScore={!scoresPublic(tournament)}
        />
      </div>
    );
  }

  // No live match - show next match or idle state based on whenIdle config
  const whenIdleType = slide.config.whenIdle?.type ?? 'next-match';

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
      ) : nextMatch ? (
        (() => {
          const nextTeamA = sideTeam(nextMatch, 'A', teams);
          const nextTeamB = sideTeam(nextMatch, 'B', teams);
          return (
            <>
              <div style={{
                fontSize: displayFontSizes.bodyLG,
                color: themeColors.textMuted,
                marginBottom: displaySpacing.contentLG,
              }}>
                {t('slides.live.nextMatch')}
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: displaySpacing.sectionMD,
              }}>
                <div style={{ textAlign: 'center' }}>
                  {nextTeamA && (
                    <TeamAvatar team={nextTeamA} size="xxl" showColorRing />
                  )}
                  <div style={{
                    fontSize: displayFontSizes.headingMD,
                    color: themeColors.text,
                    marginTop: cssVars.spacing.md,
                  }}>
                    {sideLabel(nextMatch, 'A', labelCtx)}
                  </div>
                </div>

                <div style={{
                  fontSize: displayFontSizes.headingLG,
                  color: themeColors.textMuted,
                  padding: `0 ${displaySpacing.contentLG}`,
                }}>
                  vs
                </div>

                <div style={{ textAlign: 'center' }}>
                  {nextTeamB && (
                    <TeamAvatar team={nextTeamB} size="xxl" showColorRing />
                  )}
                  <div style={{
                    fontSize: displayFontSizes.headingMD,
                    color: themeColors.text,
                    marginTop: cssVars.spacing.md,
                  }}>
                    {sideLabel(nextMatch, 'B', labelCtx)}
                  </div>
                </div>
              </div>
              {/* @ZM-138: Anstoßzeit des nächsten Spiels */}
              {nextMatch.scheduledTime && (
                <div style={{
                  fontSize: displayFontSizes.bodyLG,
                  color: themeColors.textSecondary,
                  marginTop: displaySpacing.contentLG,
                }}>
                  {t('slides.live.kickoff')} {formatTime(nextMatch.scheduledTime)}
                </div>
              )}
            </>
          );
        })()
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
