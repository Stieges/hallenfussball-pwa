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

import { useState, useEffect, useMemo, useCallback } from 'react';
import { displayMonitor } from '../../design-tokens';
import type { TournamentMonitor } from '../../types/monitor';
import { PERFORMANCE_PROFILES, calculateCacheStatus } from '../../types/monitor';
import { useTranslation } from 'react-i18next';
import { GoalAnimation, CardAnimation } from '../../components/monitor';
import { TimedNotice } from '../../components/ui/molecules/TimedNotice';
import { usePixelShift } from '../../hooks/usePixelShift';
import { useWakeLock } from '../../hooks/useWakeLock';
import { vollbildUmschalten } from './vollbild';
import {
  istBrowserQuelle, istCacheTaste, istEingabeZiel, istVollbildTaste, WAKE_LOCK_HINWEIS_MS,
} from './monitorDauerbetrieb';
import { useIdleCursor, useTastenAbfang, useWakeLockNachEingabe } from './useMonitorDauerbetrieb';
import {
  alleUebersprungen, selectDisplayableSlides, SPIELPLAN_FALLBACK_SLIDE, ZUSCHAUER_QR_SLIDE, type SlideProgram,
} from './slideProgramme';
import { isSlideShowable } from './publicVisibility';
import { monitorPageCount } from './slideContent';
import { useSlideshow } from './useSlideshow';
import { boundFieldNumbers, visibleGoal } from './monitorGoalFilter';
import { getPerformanceSettings } from './monitorDisplayHelpers';
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

export function MonitorDisplayPage({
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

  // L7: Hallen-Monitore laufen stundenlang unbeaufsichtigt; ohne Wake Lock dimmen Smart-TVs und
  // Beamer-Laptops ab. Erst aktivieren, wenn ein Monitor geladen ist — auf der Fehlerseite wäre
  // die Permission-Anfrage sinnlos. Kein Destructuring: noUnusedLocals ist aktiv.
  const wakeLock = useWakeLock(monitor !== null);
  // B-17 Fixrunde 2: schlägt die erste Anfrage fehl (Safari), fordert die erste Eingabe sie erneut an.
  useWakeLockNachEingabe(wakeLock.error, wakeLock.request);
  // B-17 (@ME-006): Kann das Gerät den Bildschirm nicht anlassen, zeigt die Seite das einmal klein in einer
  // Ecke. In der Browser-Quelle nie, dort steuert der Rechner den Bildschirm.
  const wakeLockHinweis = wakeLock.error !== null
    && !istBrowserQuelle(window.location.hash, navigator.userAgent);
  // W4: „einmal“ ist ein Zustand der Seite. Gezeigt wird der Hinweis höchstens einmal je Seiten-Instanz, auch wenn
  // die Seite zwischendurch in den Lade- oder Fehlerzustand geht und zurückkehrt.
  const [hinweisPhase, setHinweisPhase] = useState<'bereit' | 'zeigt' | 'erledigt'>('bereit');
  const ansichtBereit = !loading && !error && tournament !== null && monitor !== null;
  useEffect(() => {
    if (hinweisPhase === 'bereit' && ansichtBereit && wakeLockHinweis) {
      setHinweisPhase('zeigt');
    } else if (hinweisPhase === 'zeigt' && (!ansichtBereit || !wakeLockHinweis)) {
      setHinweisPhase('erledigt');
    }
  }, [hinweisPhase, ansichtBereit, wakeLockHinweis]);
  const hinweisAbgelaufen = useCallback(() => setHinweisPhase('erledigt'), []);

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

      {/* Hinweis: Bildschirm kann sich abschalten (nur im normalen Browser, einmal, B-17) */}
      {hinweisPhase === 'zeigt' && (
        <TimedNotice
          text={t('dauerbetrieb.wakeLockHint')}
          durationMs={WAKE_LOCK_HINWEIS_MS}
          onDone={hinweisAbgelaufen}
          testId="monitor-wakelock-hint"
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
  );
}

export default MonitorDisplayPage;
