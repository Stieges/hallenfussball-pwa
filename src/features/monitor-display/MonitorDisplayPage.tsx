/**
 * MonitorDisplayPage - TV/Monitor-Anzeige für Turniere
 *
 * MON-KONF-01: Fullscreen Display-Ansicht für Monitore mit Diashow
 *
 * Features:
 * - Automatischer Slide-Wechsel mit konfigurierbarer Dauer
 * - Fade/Slide/None Transitions
 * - Tasten (B-17, @ME-022): ohne Wirkung sind Pfeile, Leertaste, Escape und Backspace; „f“ = Vollbild, „c“ =
 *   Cache-Anzeige. Escape beendet nur das Vollbild (Browser). Der Mauszeiger verschwindet bei Ruhe.
 * - Performance-Modi (high/low/auto)
 * - Cache-Status-Indikator für Admins
 *
 * Route: /display/:tournamentId/:monitorId
 *
 * Bausteine: Folien in `slides/`, Rahmen und Zustandsanzeigen in `components/`,
 * Heartbeat in `useMonitorHeartbeat.ts` (B-16d2).
 *
 * @see MONITOR-KONFIGURATOR-UMSETZUNGSPLAN-v2.md P1-10 bis P1-12
 */

import { useState, useEffect, useMemo } from 'react';
import { displayMonitor, monitorThemes } from '../../design-tokens';
import type { TournamentMonitor } from '../../types/monitor';
import { PERFORMANCE_PROFILES, calculateCacheStatus } from '../../types/monitor';
import { useTranslation, I18nextProvider } from 'react-i18next';
import { ANZEIGE_SPRACHE, anzeigeI18n } from '../../i18n/anzeigeSprache';
import { GoalAnimation, CardAnimation } from '../../components/monitor';
import { HeaderNoticeContext } from '../../components/monitor/HeaderNoticeContext';
import { LiveHeaderNotice } from '../../components/monitor/LiveHeaderNotice';
import { usePixelShift } from '../../hooks/usePixelShift';
import { useWakeLock } from '../../hooks/useWakeLock';
import { vollbildUmschalten } from './vollbild';
import { istCacheTaste, istEingabeZiel, istVollbildTaste } from './monitorDauerbetrieb';
import { useWakeLockHinweis } from './useWakeLockHinweis';
import { useIdleCursor, useTastenAbfang, useWakeLockNachEingabe } from './useMonitorDauerbetrieb';
import {
  alleUebersprungen, selectDisplayableSlides, SPIELPLAN_FALLBACK_SLIDE, ZUSCHAUER_QR_SLIDE, type SlideProgram,
} from './slideProgramme';
import { isSlideShowable } from './publicVisibility';
import { monitorPageCount } from './slideContent';
import { useSlideshow } from './useSlideshow';
import { boundFieldNumbers, visibleGoal } from './monitorGoalFilter';
import { getPerformanceSettings, resolveTheme } from './monitorDisplayHelpers';
import { createLegacyMonitorSource } from './monitorDataSource';
import { useMonitorDisplayData } from './useMonitorDisplayData';
import { useMonitorEvents } from './useMonitorEvents';
import { useMonitorHeartbeat } from './useMonitorHeartbeat';
import { SlideRenderer } from './slides/SlideRenderer';
import { TransitionWrapper } from './components/TransitionWrapper';
import { CacheIndicator } from './components/CacheIndicator';
import { MonitorLoadingView, MonitorErrorView } from './components/MonitorStatusViews';
import { SlideDots, MonitorKeyframes } from './components/MonitorChrome';
import { containerStyle } from './components/monitorStyles';

// =============================================================================
// TYPES
// =============================================================================

interface MonitorDisplayPageProps {
  tournamentId: string;
  monitorId: string;
  onBack?: () => void;
}

/** Poll-Takt: ohne Monitor 5 s (schneller, bis etwas da ist), sonst das Profil-Intervall. */
const monitorPollIntervalMs = (m: TournamentMonitor | null): number =>
  m ? getPerformanceSettings(m.performanceMode).pollingInterval : 5000;

// =============================================================================
// MAIN COMPONENT
// =============================================================================

function MonitorDisplayPageContent({
  tournamentId,
  monitorId,
  onBack,
}: MonitorDisplayPageProps) {
  // Datenquelle (stabil je Ziel) und Abruf-/Zustandsregeln in den Bausteinen (B-16b2)
  const displaySource = useMemo(
    () => createLegacyMonitorSource(tournamentId, monitorId),
    [tournamentId, monitorId]
  );
  const { tournament, monitor, origin, loading, error, lastFetch } = useMonitorDisplayData(
    displaySource,
    { tournamentId, monitorId },
    monitorPollIntervalMs
  );
  const [showCacheIndicator, setShowCacheIndicator] = useState(false);
  const { t } = useTranslation('monitor');
  const cursorRuht = useIdleCursor();
  useTastenAbfang();

  // Live match events for animations (einzige Stelle mit useLiveMatches)
  // B-16e2 (@ZM-118): Kindermodus – keine Tor- oder Karten-Einblendung
  const ergebnisseAusgeblendet = tournament?.hideScoresForPublic === true;
  const { lastGoalEvent, clearLastGoalEvent, lastCardEvent, clearLastCardEvent } = useMonitorEvents(
    tournamentId,
    origin,
    ergebnisseAusgeblendet
  );

  // L7: Hallen-Monitore laufen stundenlang unbeaufsichtigt; ohne Wake Lock dimmen Smart-TVs und Beamer-Laptops ab.
  // Erst aktivieren, wenn ein Monitor geladen ist (auf der Fehlerseite wäre die Anfrage sinnlos).
  const wakeLock = useWakeLock(monitor !== null);
  // B-17 Fixrunde 2: schlägt die erste Anfrage fehl (Safari), fordert die erste Eingabe sie erneut an.
  useWakeLockNachEingabe(wakeLock.status, wakeLock.request);
  // B-17 (@ME-006): 10-s-Hinweis, wenn das Gerät den Bildschirm nicht anlassen kann (Regeln in useWakeLockHinweis).
  const ansichtBereit = !loading && !error && tournament !== null && monitor !== null;
  const hinweisZeigt = useWakeLockHinweis(wakeLock.status, ansichtBereit);
  // Ohne Kopfzeile (andere Folien) steht der Hinweis als Ecke oben rechts, die Live-Kopfzeile übernimmt ihn.
  const [kopfzeileDa, setKopfzeileDa] = useState(false);
  const hinweisWert = useMemo(
    () => ({ text: hinweisZeigt ? t('dauerbetrieb.wakeLockHint') : null, setHeaderPresent: setKopfzeileDa }),
    [hinweisZeigt, t]
  );

  // Derived state
  const performanceSettings = useMemo(
    () => monitor ? getPerformanceSettings(monitor.performanceMode) : PERFORMANCE_PROFILES.high,
    [monitor]
  );

  const cacheStatus = useMemo(
    () => calculateCacheStatus(lastFetch),
    [lastFetch]
  );

  // Anti-burn-in pixel shift for OLED/Plasma displays
  // Scale shift amount with overscan — no shift when overscan is 0 (would clip content)
  const overscanPx = monitor?.overscanPx ?? displayMonitor.overscanDefaultPx;
  const maxPixelShift = Math.min(2, Math.floor(overscanPx / 4));
  const pixelShift = usePixelShift(60_000, maxPixelShift, performanceSettings.enableAnimations);

  // Darstellbare Folien (@OB-011): Folien ohne Darstellung werden übersprungen,
  // bleibt keine übrig (auch beim leeren Programm), gilt die Zuschauer-QR-Folie.
  // F-04: Ist kein QR möglich (nicht öffentlich/ohne Share-Code), nimmt der Monitor
  // die nächste immer darstellbare Folie (Spielplan) — der Bildschirm ist nie leer.
  const qrMoeglich = tournament?.isPublic === true && Boolean(tournament?.shareCode);
  // B-16e2 (@ZM-090): Bei ausgeblendeten Ergebnissen fallen wertende Folien weg (Rückfall: QR)
  const slides = useMemo(
    () => selectDisplayableSlides(monitor?.slides ?? [], {
      qrMoeglich,
      isShowable: (slide) => isSlideShowable(slide, { hideScoresForPublic: ergebnisseAusgeblendet }),
    }),
    [monitor, qrMoeglich, ergebnisseAusgeblendet]
  );
  // Rückfall (B-16e1 Ruling, @ZM-122): Sind alle Live-Folien ohne Spiel, zeigt die Seite QR bzw. Spielplan.
  // Nur ohne Pin: Während eines Spiels und der 30-s-Haltezeit (@ZM-077) bleibt die Live-Folie sichtbar.
  const rueckfallFolie = qrMoeglich ? ZUSCHAUER_QR_SLIDE : SPIELPLAN_FALLBACK_SLIDE;

  // Folienfolge (B-16c): Takt und Übergang liegen in useSlideshow. Tasten wirken nicht (@ME-022).
  const defaultSlideDuration = monitor?.defaultSlideDuration ?? 15;
  // Spiele für die Anhalte- und Feldregeln (B-16e1): jede neue Turnier-Referenz wertet die Regeln aus.
  const slideProgram = useMemo<SlideProgram>(
    () => ({
      slides,
      defaultDurationSec: defaultSlideDuration,
      matches: tournament?.matches,
      pageCount: (slide) => monitorPageCount(slide, tournament),
    }),
    [slides, defaultSlideDuration, tournament]
  );
  const transitionMs = performanceSettings.enableTransitions && monitor?.transition !== 'none'
    ? (monitor?.transitionDuration ?? 0)
    : null;
  const { slideState } = useSlideshow(slideProgram, transitionMs);

  // Tor-Einblendung nach Feld der Live-Folien (B-16e1, @ZM-083)
  const boundFields = useMemo(() => boundFieldNumbers(monitor?.slides ?? []), [monitor]);

  // Current slide
  const currentSlide = useMemo(() => {
    const rueckfallAktiv = slideState.pinnedMatchId === null
      && alleUebersprungen(slides, tournament?.matches ?? []);
    return rueckfallAktiv ? rueckfallFolie : slides[slideState.currentIndex] ?? null;
  }, [slides, slideState.currentIndex, slideState.pinnedMatchId, rueckfallFolie, tournament]);

  // Heartbeat alle 30 s (Takt und Deps in useMonitorHeartbeat)
  useMonitorHeartbeat(monitor?.id ?? null, tournament?.id ?? null, slideState.currentIndex, cacheStatus.status);

  // ==========================================================================
  // KEYBOARD (f = Vollbild, c = Cache-Anzeige; Pfeile und Leertaste ohne Wirkung, @ME-022;
  // Escape und Backspace verlassen die Seite nicht, siehe useTastenAbfang)
  // ==========================================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (istEingabeZiel(e.target)) { return; }
      if (istVollbildTaste(e)) {
        vollbildUmschalten();
        return;
      }
      if (istCacheTaste(e)) {
        setShowCacheIndicator(s => !s);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  if (loading) {
    return <MonitorLoadingView />;
  }

  if (error || !tournament || !monitor) {
    return <MonitorErrorView error={error} onBack={onBack} />;
  }

  return (
    <HeaderNoticeContext.Provider value={hinweisWert}>
    <div style={{ ...containerStyle, cursor: cursorRuht ? 'none' : undefined }}>
      {/* Slide Container — pixelShift for OLED anti-burn-in */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        ...pixelShift,
      }}>
        {currentSlide && (
          <TransitionWrapper
            slideState={slideState}
            transitionType={monitor.transition}
            transitionDuration={monitor.transitionDuration}
            enableTransitions={performanceSettings.enableTransitions}
          >
            <SlideRenderer
              slide={currentSlide}
              tournament={tournament}
              performanceSettings={performanceSettings}
              theme={monitor.theme}
              overscanPx={monitor.overscanPx}
              pinnedMatchId={slideState.pinnedMatchId}
              page={slideState.page}
            />
          </TransitionWrapper>
        )}
      </div>

      {/* Slide Indicator */}
      {slides.length > 1 && (
        <SlideDots
          count={slides.length}
          currentIndex={slideState.currentIndex}
          enableTransitions={performanceSettings.enableTransitions}
        />
      )}

      {hinweisZeigt && !kopfzeileDa && (
        <LiveHeaderNotice
          variant="corner"
          text={t('dauerbetrieb.wakeLockHint')}
          themeColors={monitorThemes[resolveTheme(monitor.theme)]}
          overscanPx={overscanPx}
        />
      )}

      {/* Cache Indicator (Admin only) */}
      <CacheIndicator cacheStatus={cacheStatus} visible={showCacheIndicator} />

      {/* Goal Animation Overlay */}
      <GoalAnimation
        goalEvent={visibleGoal(lastGoalEvent, tournament.matches, boundFields)}
        onAnimationComplete={clearLastGoalEvent}
        sportId={tournament?.sportId}
      />

      {/* Card Animation Overlay */}
      <CardAnimation
        cardEvent={lastCardEvent}
        onAnimationComplete={clearLastCardEvent}
      />

      <MonitorKeyframes />
    </div>
    </HeaderNoticeContext.Provider>
  );
}

/** Monitor-Seite mit fester Anzeigesprache (B-41, src/i18n/anzeigeSprache.ts): eigene Instanz, globale Sprache bleibt unberührt. */
export function MonitorDisplayPage(props: MonitorDisplayPageProps) {
  return (
    <div lang={ANZEIGE_SPRACHE} style={{ display: 'contents' }}>
      <I18nextProvider i18n={anzeigeI18n()}>
        <MonitorDisplayPageContent {...props} />
      </I18nextProvider>
    </div>
  );
}

export default MonitorDisplayPage;
