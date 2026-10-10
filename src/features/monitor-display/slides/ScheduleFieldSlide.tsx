import type { CSSProperties } from 'react';
import { displayFontSizes, displaySpacing, monitorThemes } from '../../../design-tokens';
import type { Match, Tournament } from '../../../types/tournament';
import type { MonitorSlide, MonitorTheme } from '../../../types/monitor';
import { fieldIdToNumber, resolveTheme } from '../monitorDisplayHelpers';
import { sideLabel } from '../matchSides';

interface ScheduleFieldSlideProps {
  slide: MonitorSlide;
  tournament: Tournament;
  theme: MonitorTheme;
  style: CSSProperties;
}

export function ScheduleFieldSlide({ slide, tournament, theme, style }: ScheduleFieldSlideProps) {
  const resolvedTheme = resolveTheme(theme);
  const themeColors = monitorThemes[resolvedTheme];

  const fieldNumber = fieldIdToNumber(slide.config.fieldId);
  const field = tournament.fields?.find(f => f.id === slide.config.fieldId);
  const fieldName = field?.customName ?? field?.defaultName ?? `Feld ${fieldNumber}`;
  const { matches, teams } = tournament;

  // Filter matches for this field
  const fieldMatches = matches
    .filter(m => m.field === fieldNumber)
    .slice(0, 6);

  const getStatusColor = (match: Match) => {
    switch (match.matchStatus) {
      case 'running': return themeColors.liveDot;
      case 'finished': return themeColors.progressBar;
      default: return themeColors.textMuted;
    }
  };

  return (
    <div style={style}>
      {/* Header */}
      <div style={{
        fontSize: displayFontSizes.headingLG,
        fontWeight: 600,
        marginBottom: displaySpacing.sectionMD,
        color: themeColors.text,
      }}>
        📋 Spielplan {fieldName}
      </div>

      {/* Match List */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: displaySpacing.contentMD,
        width: '100%',
        maxWidth: '900px',
      }}>
        {fieldMatches.map((match) => (
          <div
            key={match.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: displaySpacing.contentLG,
              padding: displaySpacing.contentLG,
              background: match.matchStatus === 'running' ? themeColors.surfaceHover : themeColors.surface,
              borderRadius: '12px',
              border: match.matchStatus === 'running' ? `2px solid ${themeColors.liveDot}` : `1px solid ${themeColors.border}`,
            }}
          >
            {/* Status Indicator */}
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: getStatusColor(match),
              flexShrink: 0,
            }} />

            {/* Team A */}
            <div style={{
              flex: 1,
              fontSize: displayFontSizes.bodyLG,
              color: themeColors.text,
              textAlign: 'right',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {sideLabel(match, 'A', teams)}
            </div>

            {/* Score */}
            <div style={{
              minWidth: '100px',
              textAlign: 'center',
              fontSize: displayFontSizes.bodyXL,
              fontWeight: 700,
              color: match.matchStatus === 'finished' ? themeColors.score : themeColors.textMuted,
            }}>
              {match.scoreA !== undefined && match.scoreB !== undefined
                ? `${match.scoreA}:${match.scoreB}`
                : '-:-'}
            </div>

            {/* Team B */}
            <div style={{
              flex: 1,
              fontSize: displayFontSizes.bodyLG,
              color: themeColors.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {sideLabel(match, 'B', teams)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
