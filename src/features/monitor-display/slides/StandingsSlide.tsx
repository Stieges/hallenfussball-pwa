import type { CSSProperties } from 'react';
import { cssVars, displayEffects, displayFontSizes, displaySpacing, monitorThemes, displayMonitor } from '../../../design-tokens';
import type { Tournament } from '../../../types/tournament';
import type { MonitorSlide, MonitorTheme } from '../../../types/monitor';
import { calculateStandings } from '../../../utils/calculations';
import { getGroupDisplayName, resolveTheme } from '../monitorDisplayHelpers';

interface StandingsSlideProps {
  slide: MonitorSlide;
  tournament: Tournament;
  theme: MonitorTheme;
  style: CSSProperties;
}

export function StandingsSlide({ slide, tournament, theme, style }: StandingsSlideProps) {
  const resolvedTheme = resolveTheme(theme);
  const themeColors = monitorThemes[resolvedTheme];

  const groupId = slide.config.groupId;
  const groupName = getGroupDisplayName(tournament, groupId);
  const { teams, matches } = tournament;

  // Calculate standings for this group
  const standings = calculateStandings(teams, matches, tournament, groupId);

  return (
    <div style={style}>
      {/* Header */}
      <div style={{
        fontSize: displayFontSizes.headingLG,
        fontWeight: cssVars.fontWeights.semibold,
        marginBottom: displaySpacing.sectionMD,
        color: themeColors.text,
      }}>
        📊 {groupName}
      </div>

      {/* Table */}
      <div style={{
        width: '100%',
        maxWidth: displayMonitor.size.standingsMaxWidth,
        background: themeColors.surface,
        borderRadius: cssVars.borderRadius.lg,
        padding: displaySpacing.contentLG,
        boxShadow: displayEffects.cardShadow,
        border: `${cssVars.borderWidth.thin} solid ${themeColors.border}`,
      }}>
        {/* Table Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: displayMonitor.size.standingsColumns,
          gap: displaySpacing.inlineMD,
          padding: `${displaySpacing.contentSM} ${displaySpacing.contentMD}`,
          borderBottom: `${cssVars.borderWidth.thin} solid ${themeColors.border}`,
          fontSize: displayFontSizes.bodySM,
          color: themeColors.textMuted,
          fontWeight: cssVars.fontWeights.medium,
        }}>
          <div>#</div>
          <div>Team</div>
          <div style={{ textAlign: 'center' }}>S</div>
          <div style={{ textAlign: 'center' }}>U</div>
          <div style={{ textAlign: 'center' }}>N</div>
          <div style={{ textAlign: 'center' }}>Diff</div>
          <div style={{ textAlign: 'center' }}>Pkt</div>
        </div>

        {/* Table Rows */}
        {standings.map((row, idx) => (
          <div
            key={row.team.id}
            style={{
              display: 'grid',
              gridTemplateColumns: displayMonitor.size.standingsColumns,
              gap: displaySpacing.inlineMD,
              padding: `${displaySpacing.contentMD} ${displaySpacing.contentMD}`,
              borderBottom: idx < standings.length - 1 ? `${cssVars.borderWidth.thin} solid ${themeColors.border}` : 'none',
              fontSize: displayFontSizes.bodyLG,
              color: themeColors.text,
            }}
          >
            <div style={{ fontWeight: cssVars.fontWeights.semibold }}>{idx + 1}</div>
            <div style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {row.team.name}
            </div>
            <div style={{ textAlign: 'center', color: themeColors.progressBar }}>{row.won}</div>
            <div style={{ textAlign: 'center', color: themeColors.textSecondary }}>{row.drawn}</div>
            <div style={{ textAlign: 'center', color: themeColors.progressBarWarning }}>{row.lost}</div>
            <div style={{
              textAlign: 'center',
              color: row.goalDifference > 0
                ? themeColors.progressBar
                : row.goalDifference < 0
                  ? themeColors.progressBarWarning
                  : themeColors.textSecondary,
            }}>
              {row.goalDifference > 0 ? '+' : ''}{row.goalDifference}
            </div>
            <div style={{
              textAlign: 'center',
              fontWeight: cssVars.fontWeights.bold,
              color: themeColors.score,
            }}>
              {row.points}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
