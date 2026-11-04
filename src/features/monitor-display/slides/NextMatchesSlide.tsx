import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { displayList, monitorThemes } from '../../../design-tokens';
import type { Tournament } from '../../../types/tournament';
import type { TournamentView } from '../../../core/view';
import type { MonitorSlide, MonitorTheme } from '../../../types/monitor';
import { wirksamerRand } from '../overscan';
import { resolveTheme } from '../monitorDisplayHelpers';
import { nextMatchesLayout } from '../slideContent';
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
  /** Seite der Folie (B-16f3), 0-basiert; blättert, sobald die Zeilen nicht in die Bildhöhe passen (@ZM-129, @ZM-188). */
  page?: number;
  /** Wirksamer Bildrand in Prozent (@ME-067); bestimmt, wie viele Zeilen auf eine Seite passen. */
  overscanPercent?: number;
  /** Der Wachhalten-Hinweis nimmt oben Platz (@ME-006). */
  hinweisHoehe?: string;
}

/** Folie „Nächste Spiele“ (@ZM-071, @ZM-078): die nächsten offenen Spiele über alle Felder, nie ein Ergebnis. */
export function NextMatchesSlide({ slide, tournament, view, theme, style, page = 0, overscanPercent, hinweisHoehe }: NextMatchesSlideProps) {
  const { t } = useTranslation('monitor');
  const frame = { overscan: wirksamerRand(overscanPercent, null), notice: hinweisHoehe !== undefined };
  const colors = monitorThemes[resolveTheme(theme)];
  const { pages: allPages, columns } = nextMatchesLayout(view, slide.config.matchCount, frame);
  const pages = allPages.length;
  const rows = allPages[Math.min(Math.max(page, 0), pages - 1)];

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
              columns={columns}
            />
          ))}
        </div>
      )}

      <SlidePageHint page={page} pages={pages} color={colors.textMuted} />
    </div>
  );
}
