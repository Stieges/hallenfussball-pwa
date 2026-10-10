import type { CSSProperties } from 'react';
import { monitorThemes } from '../../../design-tokens';
import type { Tournament } from '../../../types/tournament';
import type { MonitorSlide, MonitorTheme, PerformanceSettings } from '../../../types/monitor';
import type { QrRueckfallFolie } from '../slideProgramme';
import { resolveTheme } from '../monitorDisplayHelpers';
import { LiveSlide } from './LiveSlide';
import { StandingsSlide } from './StandingsSlide';
import { ScheduleFieldSlide } from './ScheduleFieldSlide';
import { SponsorSlide } from './SponsorSlide';
import { CustomTextSlide } from './CustomTextSlide';
import { QrSlide } from './QrSlide';

interface SlideRendererProps {
  slide: MonitorSlide | QrRueckfallFolie;
  tournament: Tournament;
  performanceSettings: PerformanceSettings;
  theme: MonitorTheme;
  overscanPx?: number;
}

/** Wählt die Folien-Komponente nach Typ; unbekannte Typen fallen auf die Zuschauer-QR-Folie. */
export function SlideRenderer({ slide, tournament, performanceSettings, theme, overscanPx }: SlideRendererProps) {
  const resolvedTheme = resolveTheme(theme);
  const themeColors = monitorThemes[resolvedTheme];

  const slideStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: `${overscanPx ?? 48}px`,
    boxSizing: 'border-box',
    background: themeColors.backgroundGradient,
    color: themeColors.text,
    // eslint-disable-next-line local-rules/no-hardcoded-font-styles -- Monitor-Schrift Inter; kein Token mit gleichem Wert (B-16d2, Verschiebung)
    fontFamily: 'Inter, system-ui, sans-serif',
  };

  switch (slide.type) {
    case 'live':
      return <LiveSlide slide={slide} tournament={tournament} performanceSettings={performanceSettings} theme={theme} style={slideStyle} />;

    case 'standings':
      return <StandingsSlide slide={slide} tournament={tournament} theme={theme} style={slideStyle} />;

    case 'schedule-field':
      return <ScheduleFieldSlide slide={slide} tournament={tournament} theme={theme} style={slideStyle} />;

    case 'sponsor':
      return <SponsorSlide slide={slide} tournament={tournament} performanceSettings={performanceSettings} theme={theme} style={slideStyle} />;

    case 'custom-text':
      return <CustomTextSlide slide={slide} style={slideStyle} />;

    case 'qr-code':
      // E-03: Eigener Render-Pfad für die Zuschauer-QR-Folie (Rückfall, kein
      // konfigurierbarer Folien-Typ).
      return <QrSlide tournament={tournament} style={slideStyle} />;

    default:
      // @OB-011: Kein Entwickler-Hinweis — unbekannte Folien fallen auf die
      // Zuschauer-QR-Folie zurück (die Rotation überspringt sie ohnehin).
      return <QrSlide tournament={tournament} style={slideStyle} />;
  }
}
