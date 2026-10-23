import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { displayList, monitorThemes } from '../../../design-tokens';
import type { Tournament } from '../../../types/tournament';
import type { TournamentView } from '../../../core/view';
import type { MonitorSlide, MonitorTheme } from '../../../types/monitor';
import { fieldIdToNumber, resolveTheme } from '../monitorDisplayHelpers';
import { fieldSchedule, pageOf, pagesFor } from '../slideContent';
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

/** Spielplan eines Feldes (@ZM-071): alle Spiele in Anpfiff-Reihenfolge mit Uhrzeit, je Seite 6 Zeilen (@ZM-129). */
export function ScheduleFieldSlide({ slide, tournament, view, theme, style, page = 0 }: ScheduleFieldSlideProps) {
  const { t } = useTranslation('monitor');
  const themeColors = monitorThemes[resolveTheme(theme)];

  const fieldNumber = fieldIdToNumber(slide.config.fieldId);
  const field = tournament.fields?.find(f => f.id === slide.config.fieldId);
  const fieldName = field?.customName ?? field?.defaultName ?? t('fieldSelector.field', { field: fieldNumber });

  const schedule = fieldSchedule(view, fieldNumber);
  const pages = pagesFor(schedule.length);
  const rows = pageOf(schedule, page);

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
          />
        ))}
      </div>

      <SlidePageHint page={page} pages={pages} color={themeColors.textMuted} />
    </div>
  );
}
