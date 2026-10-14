import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { displayFontSizes, displaySpacing, monitorThemes, displayMonitor, cssVars } from '../../../design-tokens';
import type { Tournament } from '../../../types/tournament';
import type { MonitorSlide, MonitorTheme } from '../../../types/monitor';
import { fieldIdToNumber, resolveTheme } from '../monitorDisplayHelpers';
import { scoresPublic } from '../publicVisibility';
import { fieldSchedule, pageOf, pagesFor } from '../slideContent';
import { MonitorMatchRow } from '../components/MonitorMatchRow';
import { SlidePageHint } from '../components/SlidePageHint';

interface ScheduleFieldSlideProps {
  slide: MonitorSlide;
  tournament: Tournament;
  theme: MonitorTheme;
  style: CSSProperties;
  /** Seite der Folie (B-16f3), 0-basiert. */
  page?: number;
}

/** Spielplan eines Feldes (@ZM-071): alle Spiele in Anpfiff-Reihenfolge mit Uhrzeit, je Seite 6 Zeilen (@ZM-129). */
export function ScheduleFieldSlide({ slide, tournament, theme, style, page = 0 }: ScheduleFieldSlideProps) {
  const { t } = useTranslation('monitor');
  const themeColors = monitorThemes[resolveTheme(theme)];

  const fieldNumber = fieldIdToNumber(slide.config.fieldId);
  const field = tournament.fields?.find(f => f.id === slide.config.fieldId);
  const fieldName = field?.customName ?? field?.defaultName ?? t('slides.field', { number: fieldNumber });

  const schedule = fieldSchedule(tournament.matches, fieldNumber);
  const pages = pagesFor(schedule.length);
  const rows = pageOf(schedule, page);

  // B-16e2 (@W2A-031): Kindermodus – kein Ergebnis; offener Platz zeigt „noch offen“
  const ergebnisseAusgeblendet = !scoresPublic(tournament);

  return (
    <div style={style}>
      {/* Header */}
      <div style={{
        fontSize: displayFontSizes.headingLG,
        fontWeight: cssVars.fontWeights.semibold,
        marginBottom: displaySpacing.sectionMD,
        color: themeColors.text,
      }}>
        {t('slides.schedule.title', { field: fieldName })}
      </div>

      {/* Match List */}
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
            hidePendingOrigin={ergebnisseAusgeblendet}
            showScore={!ergebnisseAusgeblendet}
            showStatus
          />
        ))}
      </div>

      <SlidePageHint page={page} pages={pages} color={themeColors.textMuted} />
    </div>
  );
}
