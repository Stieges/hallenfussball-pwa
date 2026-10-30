import type { CSSProperties } from 'react';
import { monitorThemes, cssVars } from '../../../design-tokens';
import type { Tournament } from '../../../types/tournament';
import type { TournamentView } from '../../../core/view';
import type { MonitorSlide, MonitorTheme, PerformanceSettings } from '../../../types/monitor';
import type { EndFolie, QrRueckfallFolie } from '../slideProgramme';
import type { MonitorEnd } from '../monitorEnd';
import { resolveTheme } from '../monitorDisplayHelpers';
import { randPadding, wirksamerRand } from '../overscan';
import { LiveSlide } from './LiveSlide';
import { StandingsSlide } from './StandingsSlide';
import { ScheduleFieldSlide } from './ScheduleFieldSlide';
import { SponsorSlide } from './SponsorSlide';
import { NextMatchesSlide } from './NextMatchesSlide';
import { CustomTextSlide } from './CustomTextSlide';
import { QrSlide } from './QrSlide';
import { AllStandingsSlide } from './AllStandingsSlide';
import { FinalStandingsSlide } from './FinalStandingsSlide';
import { FinalScorersSlide } from './FinalScorersSlide';

interface SlideRendererProps {
  slide: MonitorSlide | QrRueckfallFolie | EndFolie;
  tournament: Tournament;
  /** Die gemeinsame Ansicht des Monitors (A-36c): Status, Seitentexte, Anstoß, Endstand und Sichtbarkeit */
  view: TournamentView;
  performanceSettings: PerformanceSettings;
  theme: MonitorTheme;
  /** Bildrand in Prozent je Seite (@ME-067); ohne Angabe die Vorbelegung 5 %. */
  overscanPercent?: number;
  /** Höhe des Wachhalten-Hinweises (@ME-006): solange er steht, rückt der Inhalt der Folie um sie nach unten. */
  hinweisHoehe?: string;
  /** Gepinntes Spiel der Live-Folie (B-16e1): die Folie zeigt es auch nach Abpfiff. */
  pinnedMatchId?: string | null;
  /** Seite der Folie (B-16f1, ausgewertet ab f3). */
  page?: number;
  /** Der Monitor nach dem Abschluss (R3-7): Endstand aus dem gespeicherten Stand des Servers, Kindermodus oder `none`. */
  end?: MonitorEnd;
}

/** Wählt die Folien-Komponente nach Typ; unbekannte Typen fallen auf die Zuschauer-QR-Folie. */
export function SlideRenderer({ slide, tournament, view, performanceSettings, theme, overscanPercent, hinweisHoehe, pinnedMatchId, page = 0, end = { kind: 'none' } }: SlideRendererProps) {
  const resolvedTheme = resolveTheme(theme);
  const themeColors = monitorThemes[resolvedTheme];

  const slideStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    // safe: wird der Inhalt höher als die Fläche, läuft er nach unten statt oben in den Bildrand (VISUAL-DESIGN § 3)
    justifyContent: 'safe center',
    ...randPadding(wirksamerRand(overscanPercent, null), hinweisHoehe),
    boxSizing: 'border-box',
    background: themeColors.backgroundGradient,
    color: themeColors.text,
    fontFamily: cssVars.fontFamilies.body,
  };

  switch (slide.type) {
    case 'final-standings':
      return <FinalStandingsSlide tournament={tournament} end={end} theme={theme} style={slideStyle} page={page} />;

    case 'final-scorers':
      return <FinalScorersSlide tournament={tournament} end={end} theme={theme} style={slideStyle} page={page} />;

    case 'live':
      return <LiveSlide slide={slide} tournament={tournament} view={view} performanceSettings={performanceSettings} theme={theme} style={slideStyle} pinnedMatchId={pinnedMatchId} />;

    case 'standings':
      return <StandingsSlide slide={slide} tournament={tournament} theme={theme} style={slideStyle} />;

    case 'schedule-field':
      return <ScheduleFieldSlide slide={slide} tournament={tournament} view={view} theme={theme} style={slideStyle} page={page} />;

    case 'sponsor':
      return <SponsorSlide slide={slide} tournament={tournament} performanceSettings={performanceSettings} theme={theme} style={slideStyle} />;

    case 'next-matches':
      return <NextMatchesSlide slide={slide} tournament={tournament} view={view} theme={theme} style={slideStyle} page={page} />;

    case 'all-standings':
      return <AllStandingsSlide tournament={tournament} view={view} theme={theme} style={slideStyle} page={page} />;

    case 'custom-text':
      return <CustomTextSlide slide={slide} style={slideStyle} />;

    case 'qr-code':
      // E-03: Eigener Render-Pfad für die Zuschauer-QR-Folie (Programm-Folie
      // `qr-code` und Rückfall).
      return <QrSlide tournament={tournament} style={slideStyle} />;

    default:
      // @OB-011: Kein Entwickler-Hinweis — unbekannte Folien fallen auf die
      // Zuschauer-QR-Folie zurück (die Rotation überspringt sie ohnehin).
      return <QrSlide tournament={tournament} style={slideStyle} />;
  }
}
