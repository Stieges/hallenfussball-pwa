/**
 * MonitorDisplayPage - TV/Monitor-Anzeige für Turniere
 *
 * MON-KONF-01: Fullscreen Display-Ansicht für Monitore mit Diashow
 *
 * Features:
 * - Automatischer Slide-Wechsel mit konfigurierbarer Dauer
 * - Fade/Slide/None Transitions
 * - Keyboard-Navigation (Pfeiltasten, Escape, Space)
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
import { displayMonitor } from '../../design-tokens';
import type { TournamentMonitor } from '../../types/monitor';
import { PERFORMANCE_PROFILES, calculateCacheStatus } from '../../types/monitor';
import { GoalAnimation, CardAnimation } from '../../components/monitor';
import { usePixelShift } from '../../hooks/usePixelShift';
import { useWakeLock } from '../../hooks/useWakeLock';
import {
  mitRueckfall, selectDisplayableSlides, SPIELPLAN_FALLBACK_SLIDE, ZUSCHAUER_QR_SLIDE, type SlideProgram,
} from './slideProgramme';
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
import { SlideDots, PauseBadge, MonitorKeyframes } from './components/MonitorChrome';
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

  // Live match events for animations (einzige Stelle mit useLiveMatches)
  const { lastGoalEvent, clearLastGoalEvent, lastCardEvent, clearLastCardEvent } = useMonitorEvents(
    tournamentId,
    origin
  );

  // L7: Hallen-Monitore laufen stundenlang unbeaufsichtigt; ohne Wake Lock dimmen Smart-TVs und
  // Beamer-Laptops ab. Erst aktivieren, wenn ein Monitor geladen ist — auf der Fehlerseite wäre
  // die Permission-Anfrage sinnlos. Kein Destructuring: noUnusedLocals ist aktiv.
  useWakeLock(monitor !== null);

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
  // Sind alle Live-Folien ohne Spiel, gilt der Rückfall (B-16e1 Ruling, @ZM-122).
  const slides = useMemo(() => {
    const qrMoeglich = tournament?.isPublic === true && Boolean(tournament?.shareCode);
    return mitRueckfall(
      selectDisplayableSlides(monitor?.slides ?? [], { qrMoeglich }),
      tournament?.matches ?? [],
      qrMoeglich ? ZUSCHAUER_QR_SLIDE : SPIELPLAN_FALLBACK_SLIDE
    );
  }, [monitor, tournament]);

  // Folienfolge (B-16c): Takt, Pause, Pfeiltasten, Leertaste und Übergang liegen in useSlideshow.
  const defaultSlideDuration = monitor?.defaultSlideDuration ?? 15;
  // Spiele für die Anhalte- und Feldregeln (B-16e1): jede neue Turnier-Referenz wertet die Regeln aus.
  const slideProgram = useMemo<SlideProgram>(
    () => ({ slides, defaultDurationSec: defaultSlideDuration, matches: tournament?.matches }),
    [slides, defaultSlideDuration, tournament]
  );
  const transitionMs = performanceSettings.enableTransitions && monitor?.transition !== 'none'
    ? (monitor?.transitionDuration ?? 0)
    : null;
  const { slideState, isPaused } = useSlideshow(slideProgram, transitionMs);

  // Tor-Einblendung nach Feld der Live-Folien (B-16e1, @ZM-083)
  const boundFields = useMemo(() => boundFieldNumbers(monitor?.slides ?? []), [monitor]);

  // Current slide
  const currentSlide = useMemo(
    () => slides[slideState.currentIndex] ?? null,
    [slides, slideState.currentIndex]
  );

  // Heartbeat alle 30 s (Takt und Deps in useMonitorHeartbeat)
  useMonitorHeartbeat(monitor?.id ?? null, tournament?.id ?? null, slideState.currentIndex, cacheStatus.status);

  // ==========================================================================
  // KEYBOARD (Escape, c; Pfeile und Leertaste liegen in useSlideshow)
  // ==========================================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onBack?.();
          break;
        case 'c':
          setShowCacheIndicator(s => !s);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack]);

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
    <div style={containerStyle}>
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

      {/* Pause Indicator */}
      {isPaused && <PauseBadge />}

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
