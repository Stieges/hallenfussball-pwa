import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, displayFontSizes, displaySpacing, monitorThemes } from '../../../design-tokens';
import type { Tournament } from '../../../types/tournament';
import type { TournamentView } from '../../../core/view';
import type { MonitorSlide, MonitorTheme, PerformanceSettings } from '../../../types/monitor';
import { TeamAvatar } from '../../../components/ui/TeamAvatar';
import { LiveMatchDisplay } from '../../../components/monitor';
import { fieldIdToNumber, resolveTheme } from '../monitorDisplayHelpers';
import { toLiveMatch } from '../monitorMatch';
import { monitorSideLabel, sideTeam } from '../matchSides';

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
          colorScheme={slide.config.liveColorScheme}
          hideScore={!view.rules.results}
          finalScore={shown.score}
          finalRound={shown.phase === 'final'}
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
          const nextTeamA = sideTeam(nextMatch.home, teams);
          const nextTeamB = sideTeam(nextMatch.away, teams);
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
                  <div data-teamname style={{
                    fontSize: displayFontSizes.headingMD,
                    color: themeColors.text,
                    marginTop: cssVars.spacing.md,
                  }}>
                    {monitorSideLabel(nextMatch.home)}
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
                  <div data-teamname style={{
                    fontSize: displayFontSizes.headingMD,
                    color: themeColors.text,
                    marginTop: cssVars.spacing.md,
                  }}>
                    {monitorSideLabel(nextMatch.away)}
                  </div>
                </div>
              </div>
              {/* @ZM-138: Anstoßzeit des nächsten Spiels */}
              {nextMatch.kickoff && (
                <div style={{
                  fontSize: displayFontSizes.bodyLG,
                  color: themeColors.textSecondary,
                  marginTop: displaySpacing.contentLG,
                }}>
                  {t('slides.live.kickoff')} {nextMatch.kickoff.time}
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
