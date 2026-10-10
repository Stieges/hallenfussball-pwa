import type { CSSProperties } from 'react';
import { cssVars, displayFontSizes, displaySpacing, monitorThemes } from '../../../design-tokens';
import type { Tournament } from '../../../types/tournament';
import type { MonitorSlide, MonitorTheme, PerformanceSettings } from '../../../types/monitor';
import { TeamAvatar } from '../../../components/ui/TeamAvatar';
import { LiveMatchDisplay } from '../../../components/monitor';
import { fieldIdToNumber, resolveTheme } from '../monitorDisplayHelpers';
import { toLiveMatch } from '../monitorMatch';
import { sideLabel, sideTeam } from '../matchSides';

interface LiveSlideProps {
  slide: MonitorSlide;
  tournament: Tournament;
  performanceSettings: PerformanceSettings;
  theme: MonitorTheme;
  style: CSSProperties;
}

export function LiveSlide({ slide, tournament, theme, style }: LiveSlideProps) {
  const resolvedTheme = resolveTheme(theme);
  const themeColors = monitorThemes[resolvedTheme];

  const fieldNumber = fieldIdToNumber(slide.config.fieldId);
  const field = tournament.fields?.find(f => f.id === slide.config.fieldId);
  const fieldName = field?.customName ?? field?.defaultName ?? `Feld ${fieldNumber}`;
  const { matches, teams } = tournament;

  // Find currently running match on this field
  const runningMatch = matches.find(
    m => m.field === fieldNumber && m.matchStatus === 'running'
  );

  // Find next scheduled match if no live match
  const nextMatch = !runningMatch
    ? matches.find(m => m.field === fieldNumber && (!m.matchStatus || m.matchStatus === 'scheduled'))
    : null;

  // Delegate to LiveMatchDisplay for running matches
  if (runningMatch) {
    const liveMatch = toLiveMatch(runningMatch, teams, tournament);
    return (
      <div style={style}>
        <LiveMatchDisplay
          match={liveMatch}
          group={runningMatch.group}
          fullscreen
          theme={theme}
          colorScheme={slide.config.liveColorScheme}
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
        ⚽ {fieldName}
      </div>

      {whenIdleType === 'skip' ? (
        <div style={{
          fontSize: displayFontSizes.bodyLG,
          color: themeColors.textMuted,
        }}>
          Warte auf nächstes Spiel...
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
                Nächstes Spiel
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
                    {sideLabel(nextMatch, 'A', teams)}
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
                    {sideLabel(nextMatch, 'B', teams)}
                  </div>
                </div>
              </div>
            </>
          );
        })()
      ) : (
        <div style={{
          fontSize: displayFontSizes.bodyLG,
          color: themeColors.textMuted,
        }}>
          Kein Spiel geplant
        </div>
      )}
    </div>
  );
}
