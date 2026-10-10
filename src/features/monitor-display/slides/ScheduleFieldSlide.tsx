import type { CSSProperties } from 'react';
import { displayFontSizes, displaySpacing, monitorThemes, displayMonitor, cssVars } from '../../../design-tokens';
import type { Match, Tournament } from '../../../types/tournament';
import type { MonitorSlide, MonitorTheme } from '../../../types/monitor';
import { fieldIdToNumber, resolveTheme } from '../monitorDisplayHelpers';
import { sideLabel } from '../matchSides';
import { scoresPublic } from '../publicVisibility';

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

  // B-16e2 (@W2A-031): Kindermodus – kein Ergebnis, Paarung und Feld bleiben
  const ergebnisseAusgeblendet = !scoresPublic(tournament);
  const labelCtx = { teams, hidePendingOrigin: ergebnisseAusgeblendet };

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
        fontWeight: cssVars.fontWeights.semibold,
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
        maxWidth: displayMonitor.size.scheduleMaxWidth,
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
              borderRadius: displayMonitor.radius.card,
              border: match.matchStatus === 'running'
                ? `${displayMonitor.marker.liveBorderWidth} solid ${themeColors.liveDot}`
                : `${cssVars.borderWidth.thin} solid ${themeColors.border}`,
            }}
          >
            {/* Status Indicator */}
            <div style={{
              width: displayMonitor.marker.scheduleSize,
              height: displayMonitor.marker.scheduleSize,
              borderRadius: cssVars.borderRadius.full,
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
              {sideLabel(match, 'A', labelCtx)}
            </div>

            {/* Score */}
            {!ergebnisseAusgeblendet && (
              <div style={{
                minWidth: displayMonitor.size.scheduleMinColumnWidth,
                textAlign: 'center',
                fontSize: displayFontSizes.bodyXL,
                fontWeight: cssVars.fontWeights.bold,
                color: match.matchStatus === 'finished' ? themeColors.score : themeColors.textMuted,
              }}>
                {match.scoreA !== undefined && match.scoreB !== undefined
                  ? `${match.scoreA}:${match.scoreB}`
                  : '-:-'}
              </div>
            )}

            {/* Team B */}
            <div style={{
              flex: 1,
              fontSize: displayFontSizes.bodyLG,
              color: themeColors.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {sideLabel(match, 'B', labelCtx)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
