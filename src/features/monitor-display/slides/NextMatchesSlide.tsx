import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, displayFontSizes, displayMonitor, displaySpacing, monitorThemes } from '../../../design-tokens';
import type { Tournament } from '../../../types/tournament';
import { DEFAULT_SLIDE_CONFIG, type MonitorSlide, type MonitorTheme } from '../../../types/monitor';
import { resolveTheme } from '../monitorDisplayHelpers';
import { scoresPublic } from '../publicVisibility';
import { upcomingMatches } from '../slideContent';
import { MonitorMatchRow } from '../components/MonitorMatchRow';

interface NextMatchesSlideProps {
  slide: MonitorSlide;
  tournament: Tournament;
  theme: MonitorTheme;
  style: CSSProperties;
}

/** Folie „Nächste Spiele“ (@ZM-071, @ZM-078): die nächsten offenen Spiele über alle Felder, nie ein Ergebnis. */
export function NextMatchesSlide({ slide, tournament, theme, style }: NextMatchesSlideProps) {
  const { t } = useTranslation('monitor');
  const colors = monitorThemes[resolveTheme(theme)];
  const count = slide.config.matchCount ?? DEFAULT_SLIDE_CONFIG.matchCount ?? 3;
  const rows = upcomingMatches(tournament.matches, { count });
  const hidePendingOrigin = !scoresPublic(tournament);

  return (
    <div style={style}>
      <div style={{
        fontSize: displayFontSizes.headingLG,
        fontWeight: cssVars.fontWeights.semibold,
        marginBottom: displaySpacing.sectionMD,
        color: colors.text,
      }}>
        {t('slides.nextMatches.title')}
      </div>

      {rows.length === 0 ? (
        <div style={{ fontSize: displayFontSizes.bodyLG, color: colors.textMuted }}>
          {t('slides.nextMatches.none')}
        </div>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: displaySpacing.contentMD,
          width: '100%',
          maxWidth: displayMonitor.size.scheduleMaxWidth,
        }}>
          {rows.map(match => (
            <MonitorMatchRow
              key={match.id}
              match={match}
              teams={tournament.teams}
              tournament={tournament}
              theme={theme}
              hidePendingOrigin={hidePendingOrigin}
            />
          ))}
        </div>
      )}
    </div>
  );
}
