import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { displayList, monitorThemes } from '../../../design-tokens';
import type { Tournament } from '../../../types/tournament';
import type { TournamentView } from '../../../core/view';
import type { MonitorSlide, MonitorTheme } from '../../../types/monitor';
import { wirksamerRand } from '../overscan';
import { fieldIdToNumber, resolveTheme } from '../monitorDisplayHelpers';
import { listFrame, scheduleFieldLayout } from '../slideContent';
import { MonitorMatchRow } from '../components/MonitorMatchRow';
import { SlidePageHint } from '../components/SlidePageHint';
import { SlideHeading } from '../components/SlideHeading';

interface ScheduleFieldSlideProps {
  slide: MonitorSlide;
  tournament: Tournament;
  /** Die gemeinsame Ansicht des Monitors (A-36c) */
  view: TournamentView;
  theme: MonitorTheme;
  style: CSSProperties;
  /** Seite der Folie (B-16f3), 0-basiert. */
  page?: number;
  /** Wirksamer Bildrand in Prozent (@ME-067); bestimmt, wie viele Zeilen auf eine Seite passen. */
  overscanPercent?: number;
  /** Startseite (@ZM-190), beim Eintritt festgehalten: die Folie zeigt zuerst diese Seite, die übrigen folgen im Durchlauf. */
  pageStart?: number;
}

/** Spielplan eines Feldes (@ZM-071): alle Spiele in Anpfiff-Reihenfolge mit Uhrzeit, Seiten nach Höhe, höchstens 4 Spiele je Seite (@ZM-129, @ZM-185, @ZM-188). */
export function ScheduleFieldSlide({ slide, tournament, view, theme, style, page = 0, pageStart = 0, overscanPercent }: ScheduleFieldSlideProps) {
  const { t } = useTranslation('monitor');
  const frame = listFrame(slide, wirksamerRand(overscanPercent, null));
  const themeColors = monitorThemes[resolveTheme(theme)];

  const fieldNumber = fieldIdToNumber(slide.config.fieldId);
  const field = tournament.fields?.find(f => f.id === slide.config.fieldId);
  const fieldName = field?.customName ?? field?.defaultName ?? t('fieldSelector.field', { field: fieldNumber });

  const { pages: allPages, columns } = scheduleFieldLayout(view, fieldNumber, frame);
  const pages = allPages.length;
  // Seite im Durchlauf (0 = Startseite) → Seite in Anpfiff-Reihenfolge; die beendeten Seiten folgen zuletzt (@ZM-190)
  const rows = allPages[(Math.min(Math.max(page, 0), pages - 1) + pageStart) % pages];

  // B-16e2 (@W2A-031): Kindermodus – kein Ergebnis; die Seitentexte („noch offen“) kommen fertig aus der Ansicht
  const ergebnisseAusgeblendet = !view.rules.results;

  return (
    <div style={style}>
      <SlideHeading icon="schedule" color={themeColors.text}>{t('slides.schedule.title', { field: fieldName })}</SlideHeading>

      {/* Match List */}
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
            showScore={!ergebnisseAusgeblendet}
            columns={columns}
            frame={frame}
          />
        ))}
      </div>

      <SlidePageHint page={page} pages={pages} color={themeColors.textMuted} />
    </div>
  );
}
