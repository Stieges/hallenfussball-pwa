import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, displayFontSizes, displayMonitor, displaySpacing, monitorThemes } from '../../../design-tokens';
import type { Tournament } from '../../../types/tournament';
import type { MonitorSlide, MonitorTheme } from '../../../types/monitor';
import { resolveTheme } from '../monitorDisplayHelpers';
import { scoresPublic } from '../publicVisibility';
import { nextMatchList, pageOf, pagesFor } from '../slideContent';
import { MonitorMatchRow } from '../components/MonitorMatchRow';
import { SlidePageHint } from '../components/SlidePageHint';

interface NextMatchesSlideProps {
  slide: MonitorSlide;
  tournament: Tournament;
  theme: MonitorTheme;
  style: CSSProperties;
  /** Seite der Folie (B-16f3), 0-basiert; ab 7 Zeilen blättert die Folie (@ZM-129). */
  page?: number;
}

/** Folie „Nächste Spiele“ (@ZM-071, @ZM-078): die nächsten offenen Spiele über alle Felder, nie ein Ergebnis. */
export function NextMatchesSlide({ slide, tournament, theme, style, page = 0 }: NextMatchesSlideProps) {
  const { t } = useTranslation('monitor');
  const colors = monitorThemes[resolveTheme(theme)];
  const list = nextMatchList(tournament.matches, slide.config.matchCount);
  const rows = pageOf(list, page);
  const pages = pagesFor(list.length);
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

      <SlidePageHint page={page} pages={pages} color={colors.textMuted} />
    </div>
  );
}
