import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { displayList, monitorThemes } from '../../../design-tokens';
import type { Tournament } from '../../../types/tournament';
import type { TournamentView } from '../../../core/view';
import type { MonitorSlide, MonitorTheme } from '../../../types/monitor';
import { resolveTheme } from '../monitorDisplayHelpers';
import { hasTimeNotes, nextMatchList, pageOf, pagesFor } from '../slideContent';
import { MonitorMatchRow } from '../components/MonitorMatchRow';
import { SlidePageHint } from '../components/SlidePageHint';
import { SlideHeading } from '../components/SlideHeading';

interface NextMatchesSlideProps {
  slide: MonitorSlide;
  tournament: Tournament;
  /** Die gemeinsame Ansicht des Monitors (A-36c) */
  view: TournamentView;
  theme: MonitorTheme;
  style: CSSProperties;
  /** Seite der Folie (B-16f3), 0-basiert; ab 7 Zeilen blättert die Folie (@ZM-129). */
  page?: number;
}

/** Folie „Nächste Spiele“ (@ZM-071, @ZM-078): die nächsten offenen Spiele über alle Felder, nie ein Ergebnis. */
export function NextMatchesSlide({ slide, tournament, view, theme, style, page = 0 }: NextMatchesSlideProps) {
  const { t } = useTranslation('monitor');
  const colors = monitorThemes[resolveTheme(theme)];
  const list = nextMatchList(view, slide.config.matchCount);
  const rows = pageOf(list, page);
  const pages = pagesFor(list.length);

  return (
    <div style={style}>
      <SlideHeading icon="nextMatches" color={colors.text}>{t('slides.nextMatches.title')}</SlideHeading>

      {rows.length === 0 ? (
        <div style={{ fontSize: displayList.fontSizes.team, color: colors.textMuted }}>
          {t('slides.nextMatches.none')}
        </div>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: displayList.rowGap,
          width: '100%',
        }}>
          {rows.map(match => (
            <MonitorMatchRow
              key={match.id}
              match={match}
              tournament={tournament}
              theme={theme}
              wideTime={hasTimeNotes(rows)}
            />
          ))}
        </div>
      )}

      <SlidePageHint page={page} pages={pages} color={colors.textMuted} />
    </div>
  );
}
