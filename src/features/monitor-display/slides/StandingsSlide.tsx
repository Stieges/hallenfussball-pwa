import type { CSSProperties } from 'react';
import { displayEffects, displayFontSizes, displaySpacing, monitorThemes } from '../../../design-tokens';
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
        fontWeight: 600,
        marginBottom: displaySpacing.sectionMD,
        color: themeColors.text,
      }}>
        📊 {groupName}
      </div>

      {/* Table */}
      <div style={{
        width: '100%',
        maxWidth: '800px',
        background: themeColors.surface,
        borderRadius: '16px',
        padding: displaySpacing.contentLG,
        boxShadow: displayEffects.cardShadow,
        border: `1px solid ${themeColors.border}`,
      }}>
        {/* Table Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '48px 1fr 48px 48px 48px 64px 64px',
          gap: displaySpacing.inlineMD,
          padding: `${displaySpacing.contentSM} ${displaySpacing.contentMD}`,
          borderBottom: `1px solid ${themeColors.border}`,
          fontSize: displayFontSizes.bodySM,
          color: themeColors.textMuted,
          fontWeight: 500,
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
              gridTemplateColumns: '48px 1fr 48px 48px 48px 64px 64px',
              gap: displaySpacing.inlineMD,
              padding: `${displaySpacing.contentMD} ${displaySpacing.contentMD}`,
              borderBottom: idx < standings.length - 1 ? `1px solid ${themeColors.border}` : 'none',
              fontSize: displayFontSizes.bodyLG,
              color: themeColors.text,
            }}
          >
            <div style={{ fontWeight: 600 }}>{idx + 1}</div>
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
              fontWeight: 700,
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
