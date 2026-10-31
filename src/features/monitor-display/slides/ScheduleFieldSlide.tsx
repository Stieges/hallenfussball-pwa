import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { displayList, monitorThemes } from '../../../design-tokens';
import type { Tournament } from '../../../types/tournament';
import type { TournamentView } from '../../../core/view';
import type { MonitorSlide, MonitorTheme } from '../../../types/monitor';
import { fieldIdToNumber, resolveTheme } from '../monitorDisplayHelpers';
import { fieldSchedule, pageOf, pagesFor, scheduleRowsFor } from '../slideContent';
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
}

/** Spielplan eines Feldes (@ZM-071): alle Spiele in Anpfiff-Reihenfolge mit Uhrzeit, je Seite bis zu 4 Zeilen (bei langen Namen 3) mit dem Logo über dem Namen (@ZM-185). */
export function ScheduleFieldSlide({ slide, tournament, view, theme, style, page = 0 }: ScheduleFieldSlideProps) {
  const { t } = useTranslation('monitor');
  const themeColors = monitorThemes[resolveTheme(theme)];

  const fieldNumber = fieldIdToNumber(slide.config.fieldId);
  const field = tournament.fields?.find(f => f.id === slide.config.fieldId);
  const fieldName = field?.customName ?? field?.defaultName ?? t('fieldSelector.field', { field: fieldNumber });

  const schedule = fieldSchedule(view, fieldNumber);
  const rowsPerPage = scheduleRowsFor(schedule);
  const pages = pagesFor(schedule.length, rowsPerPage);
  const rows = pageOf(schedule, page, rowsPerPage);

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
            showStatus
            logoPlacement="above"
          />
        ))}
      </div>

      <SlidePageHint page={page} pages={pages} color={themeColors.textMuted} />
    </div>
  );
}
