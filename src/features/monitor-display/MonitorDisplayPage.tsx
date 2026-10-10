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
 * @see MONITOR-KONFIGURATOR-UMSETZUNGSPLAN-v2.md P1-10 bis P1-12
 */

import { useState, useEffect, useMemo, useRef, CSSProperties } from 'react';
import {
  displayColors,
  displayFontSizes,
  displaySpacing,
  displayEffects,
  displayColorSchemes,
  monitorThemes,
} from '../../design-tokens';
import type { Tournament } from '../../types/tournament';
import type {
  TournamentMonitor,
  MonitorSlide,
  TransitionType,
  PerformanceSettings,
  MonitorTheme,
} from '../../types/monitor';
import { PERFORMANCE_PROFILES, calculateCacheStatus, CacheStatus } from '../../types/monitor';
import { GoalAnimation, CardAnimation } from '../../components/monitor';
import { generateTournamentUrl, generateLiveUrl } from '../../utils/shareUtils';
import { QRCodeSVG } from 'qrcode.react';
import { usePixelShift } from '../../hooks/usePixelShift';
import { useWakeLock } from '../../hooks/useWakeLock';
import { supabase } from '../../lib/supabase';
import { captureFeatureError } from '../../lib/sentry';
import { selectDisplayableSlides, type QrRueckfallFolie, type SlideProgram } from './slideProgramme';
import { useSlideshow } from './useSlideshow';
import { resolveTheme, getPerformanceSettings, getSafeUrl } from './monitorDisplayHelpers';
import { LiveSlide } from './slides/LiveSlide';
import { StandingsSlide } from './slides/StandingsSlide';
import { ScheduleFieldSlide } from './slides/ScheduleFieldSlide';
import { createLegacyMonitorSource } from './monitorDataSource';
import { useMonitorDisplayData } from './useMonitorDisplayData';
import { useMonitorEvents } from './useMonitorEvents';

// =============================================================================
// TYPES
// =============================================================================

interface MonitorDisplayPageProps {
  tournamentId: string;
  monitorId: string;
  onBack?: () => void;
}

interface SlideState {
  currentIndex: number;
  isTransitioning: boolean;
  direction: 'next' | 'prev';
}

/** Poll-Takt: ohne Monitor 5 s (schneller, bis etwas da ist), sonst das Profil-Intervall. */
const monitorPollIntervalMs = (m: TournamentMonitor | null): number =>
  m ? getPerformanceSettings(m.performanceMode).pollingInterval : 5000;

// =============================================================================
// SLIDE RENDERER COMPONENT
// =============================================================================

interface SlideRendererProps {
  slide: MonitorSlide | QrRueckfallFolie;
  tournament: Tournament;
  performanceSettings: PerformanceSettings;
  theme: MonitorTheme;
  overscanPx?: number;
}

function SlideRenderer({ slide, tournament, performanceSettings, theme, overscanPx }: SlideRendererProps) {
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

// =============================================================================
// ZUSCHAUER-QR-FOLIE (@OB-011 Rückfall)
// =============================================================================

interface QrSlideProps {
  tournament: Tournament;
  style: CSSProperties;
}

function QrSlide({ tournament, style }: QrSlideProps) {
  // F-03: Der QR zeigt die Zuschauer-Adresse (generateLiveUrl) — nie die Verwaltung
  // (generateTournamentUrl). Nur bei isPublic && shareCode gibt es überhaupt einen QR.
  const shareCode = tournament.shareCode;
  const qrUrl = tournament.isPublic === true && typeof shareCode === 'string' && shareCode.length > 0
    ? generateLiveUrl(shareCode)
    : null;
  return (
    <div style={{ ...style, gap: displaySpacing.sectionMD }}>
      <div style={{ fontSize: displayFontSizes.headingXL, fontWeight: 700 }}>
        {tournament.title}
      </div>
      {qrUrl && (
        <>
          <QRCodeSVG
            value={qrUrl}
            size={220}
            bgColor="white"
            fgColor="black"
            level="M"
          />
          <div style={{ fontSize: displayFontSizes.bodyMD }}>
            {qrUrl}
          </div>
        </>
      )}
      {!qrUrl && (
        <div style={{ fontSize: displayFontSizes.bodyMD }}>
          Schau auf die Anzeige in der Halle – hier läuft das Spiel live mit.
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SPONSOR SLIDE
// =============================================================================

interface SponsorSlideProps {
  slide: MonitorSlide;
  tournament: Tournament;
  performanceSettings: PerformanceSettings;
  theme: MonitorTheme;
  style: CSSProperties;
}

function SponsorSlide({ slide, tournament, performanceSettings, theme, style }: SponsorSlideProps) {
  const resolvedTheme = resolveTheme(theme);
  const themeColors = monitorThemes[resolvedTheme];

  const sponsorId = slide.config.sponsorId;
  const sponsors = tournament.sponsors ?? [];
  const sponsor = sponsors.find(s => s.id === sponsorId);

  if (!sponsor) {
    return (
      <div style={style}>
        <div style={{ fontSize: displayFontSizes.headingMD, color: themeColors.textMuted }}>
          Sponsor nicht gefunden
        </div>
      </div>
    );
  }

  // Use logoUrl or logoBase64
  const logoSrc = sponsor.logoUrl ?? sponsor.logoBase64;

  // Generate QR code URL with validation to prevent XSS
  const fallbackUrl = generateTournamentUrl(tournament.id);
  const qrUrl = slide.config.qrTarget === 'sponsor-website' && sponsor.websiteUrl
    ? getSafeUrl(sponsor.websiteUrl, fallbackUrl)
    : slide.config.qrTarget === 'custom' && slide.config.customQrUrl
      ? getSafeUrl(slide.config.customQrUrl, fallbackUrl)
      : fallbackUrl;

  return (
    <div style={style}>
      {/* Sponsor Logo or Name */}
      {logoSrc ? (
        <img
          src={logoSrc}
          alt={sponsor.name}
          style={{
            maxWidth: '400px',
            maxHeight: '300px',
            objectFit: 'contain',
            marginBottom: displaySpacing.sectionLG,
            boxShadow: performanceSettings.enableGlow ? displayEffects.cardShadow : 'none',
          }}
        />
      ) : (
        <div style={{
          fontSize: displayFontSizes.headingXL,
          fontWeight: 700,
          color: themeColors.text,
          marginBottom: displaySpacing.sectionLG,
        }}>
          {sponsor.name}
        </div>
      )}

      {/* Sponsor Tier Badge */}
      {sponsor.tier && (
        <div style={{
          fontSize: displayFontSizes.bodyMD,
          color: themeColors.textSecondary,
          marginBottom: displaySpacing.sectionMD,
          textTransform: 'capitalize',
        }}>
          {sponsor.tier === 'gold' ? '🥇' : sponsor.tier === 'silver' ? '🥈' : '🥉'} {sponsor.tier} Sponsor
        </div>
      )}

      {/* QR Code Placeholder */}
      {slide.config.showQrCode !== false && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginTop: displaySpacing.sectionMD,
        }}>
          <QRCodeSVG
            value={qrUrl}
            size={150}
            bgColor="#ffffff"
            fgColor="#000000"
            level="M"
            style={{
              borderRadius: '12px',
            }}
          />
          <div style={{
            fontSize: displayFontSizes.bodySM,
            color: themeColors.textMuted,
            marginTop: displaySpacing.contentSM,
          }}>
            Scan für mehr Info
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// CUSTOM TEXT SLIDE
// =============================================================================

interface CustomTextSlideProps {
  slide: MonitorSlide;
  style: CSSProperties;
}

function CustomTextSlide({ slide, style }: CustomTextSlideProps) {
  const colorSchemeKey = slide.config.colorScheme;
  const scheme = (colorSchemeKey && colorSchemeKey in displayColorSchemes)
    ? displayColorSchemes[colorSchemeKey]
    : displayColorSchemes.default;

  return (
    <div style={{
      ...style,
      background: scheme.background,
      color: scheme.text,
      textAlign: slide.config.textAlign ?? 'center',
    }}>
      {/* Headline */}
      {slide.config.headline && (
        <div style={{
          fontSize: displayFontSizes.headingXL,
          fontWeight: 700,
          marginBottom: displaySpacing.sectionMD,
        }}>
          {slide.config.headline}
        </div>
      )}

      {/* Body */}
      {slide.config.body && (
        <div style={{
          fontSize: displayFontSizes.headingMD,
          maxWidth: '800px',
          lineHeight: 1.5,
        }}>
          {slide.config.body}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// TRANSITION WRAPPER
// =============================================================================

interface TransitionWrapperProps {
  children: React.ReactNode;
  slideState: SlideState;
  transitionType: TransitionType;
  transitionDuration: number;
  enableTransitions: boolean;
}

function TransitionWrapper({
  children,
  slideState,
  transitionType,
  transitionDuration,
  enableTransitions,
}: TransitionWrapperProps) {
  const getTransitionStyle = (): CSSProperties => {
    if (!enableTransitions || transitionType === 'none') {
      return {};
    }

    const baseTransition: CSSProperties = {
      transition: `all ${transitionDuration}ms cubic-bezier(0.4, 0, 0.2, 1)`,
    };

    if (transitionType === 'fade') {
      return {
        ...baseTransition,
        opacity: slideState.isTransitioning ? 0 : 1,
      };
    }

    // transitionType === 'slide' (remaining option after 'none' and 'fade')
    const translateX = slideState.isTransitioning
      ? slideState.direction === 'next' ? '-100%' : '100%'
      : '0%';
    return {
      ...baseTransition,
      transform: `translateX(${translateX})`,
    };
  };

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      ...getTransitionStyle(),
    }}>
      {children}
    </div>
  );
}

// =============================================================================
// CACHE INDICATOR
// =============================================================================

interface CacheIndicatorProps {
  cacheStatus: CacheStatus;
  visible: boolean;
}

function CacheIndicator({ cacheStatus, visible }: CacheIndicatorProps) {
  if (!visible) {return null;}

  const getStatusColor = () => {
    switch (cacheStatus.status) {
      case 'fresh': return displayColors.success;
      case 'stale': return displayColors.warning;
      case 'critical': return displayColors.error;
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: displaySpacing.contentMD,
      right: displaySpacing.contentMD,
      display: 'flex',
      alignItems: 'center',
      gap: displaySpacing.inlineSM,
      padding: `${displaySpacing.contentSM} ${displaySpacing.contentMD}`,
      background: 'rgba(0, 0, 0, 0.7)',
      borderRadius: '8px',
      fontSize: displayFontSizes.bodySM,
      color: displayColors.textPrimary,
      zIndex: 1000,
    }}>
      <div style={{
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        background: getStatusColor(),
      }} />
      <span>{cacheStatus.ageSeconds}s</span>
      <span style={{ color: displayColors.textMuted }}>
        {cacheStatus.connectionStatus}
      </span>
    </div>
  );
}

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
  const overscanPx = monitor?.overscanPx ?? 48;
  const maxPixelShift = Math.min(2, Math.floor(overscanPx / 4));
  const pixelShift = usePixelShift(60_000, maxPixelShift, performanceSettings.enableAnimations);

  // Darstellbare Folien (@OB-011): Folien ohne Darstellung werden übersprungen,
  // bleibt keine übrig (auch beim leeren Programm), gilt die Zuschauer-QR-Folie.
  // F-04: Ist kein QR möglich (nicht öffentlich/ohne Share-Code), nimmt der Monitor
  // die nächste immer darstellbare Folie (Spielplan) — der Bildschirm ist nie leer.
  const slides = useMemo(
    () => selectDisplayableSlides(monitor?.slides ?? [], {
      qrMoeglich: tournament?.isPublic === true && Boolean(tournament?.shareCode),
    }),
    [monitor, tournament]
  );

  // Folienfolge (B-16c): Takt, Pause, Pfeiltasten, Leertaste und Übergang liegen in useSlideshow.
  const defaultSlideDuration = monitor?.defaultSlideDuration ?? 15;
  const slideProgram = useMemo<SlideProgram>(
    () => ({ slides, defaultDurationSec: defaultSlideDuration }),
    [slides, defaultSlideDuration]
  );
  const transitionMs = performanceSettings.enableTransitions && monitor?.transition !== 'none'
    ? (monitor?.transitionDuration ?? 0)
    : null;
  const { slideState, isPaused } = useSlideshow(slideProgram, transitionMs);

  // Current slide
  const currentSlide = useMemo(
    () => slides[slideState.currentIndex] ?? null,
    [slides, slideState.currentIndex]
  );


  // Heartbeat sender — every 30s so admin dashboard can show online status.
  // Deps nur Ids und Primitive: neue Objekte je Poll würden den Takt sonst bei jedem Poll neu starten
  // (C-MON-HEARTBEAT-JE-POLL).
  const monitorKey = monitor?.id ?? null;
  const tournamentKey = tournament?.id ?? null;
  const heartbeatErrorReported = useRef(false);
  useEffect(() => {
    if (!monitorKey || !tournamentKey) {
      return;
    }

    const sendHeartbeat = async () => {
      if (!supabase) {
        return;
      }
      const { error } = await supabase.rpc('record_monitor_heartbeat', {
        p_monitor_id: monitorKey,
        p_tournament_id: tournamentKey,
        p_slide_index: slideState.currentIndex,
        p_cache_status: cacheStatus.status,
        p_user_agent: navigator.userAgent,
      });
      if (error && !heartbeatErrorReported.current) {
        // supabase-js wirft bei PG-Fehlern nicht — einmal pro Mount signalisieren,
        // sonst bleibt ein kaputter Heartbeat-Pfad wieder monatelang unsichtbar.
        heartbeatErrorReported.current = true;
        captureFeatureError(new Error(`heartbeat failed: ${error.message}`), 'monitor', 'heartbeat');
      }
    };

    void sendHeartbeat();
    const interval = setInterval(() => void sendHeartbeat(), 30_000);
    return () => clearInterval(interval);
  }, [monitorKey, tournamentKey, slideState.currentIndex, cacheStatus.status]);

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

  // Loading state
  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ fontSize: displayFontSizes.headingLG, color: displayColors.textSecondary }}>
          Lade Display...
        </div>
      </div>
    );
  }

  // Error state
  if (error || !tournament || !monitor) {
    return (
      <div style={containerStyle} data-testid="monitor-error-state">
        <div
          data-testid="monitor-error-message"
          style={{
            fontSize: displayFontSizes.headingMD,
            color: displayColors.error,
            marginBottom: displaySpacing.sectionMD,
          }}
        >
          {error ?? 'Konfiguration nicht gefunden'}
        </div>
        {onBack && (
          <button onClick={onBack} style={backButtonStyle}>
            ← Zurück
          </button>
        )}
      </div>
    );
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
            />
          </TransitionWrapper>
        )}
      </div>

      {/* Slide Indicator */}
      {slides.length > 1 && (
        <div style={{
          position: 'fixed',
          bottom: displaySpacing.contentLG,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: displaySpacing.inlineSM,
          zIndex: 100,
        }}>
          {slides.map((_, idx) => (
            <div
              key={idx}
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: idx === slideState.currentIndex
                  ? displayColors.primary
                  : displayColors.textMuted,
                opacity: idx === slideState.currentIndex ? 1 : 0.4,
                transition: performanceSettings.enableTransitions ? 'all 200ms ease' : 'none',
              }}
            />
          ))}
        </div>
      )}

      {/* Pause Indicator */}
      {isPaused && (
        <div
          data-testid="monitor-pause-indicator"
          style={{
            position: 'fixed',
            bottom: displaySpacing.sectionLG,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: `${displaySpacing.contentSM} ${displaySpacing.contentMD}`,
            background: 'rgba(0, 0, 0, 0.7)',
            borderRadius: '8px',
            fontSize: displayFontSizes.bodySM,
            color: displayColors.textPrimary,
            zIndex: 100,
          }}
        >
          ⏸ Pausiert (Leertaste zum Fortsetzen)
        </div>
      )}

      {/* Cache Indicator (Admin only) */}
      <CacheIndicator cacheStatus={cacheStatus} visible={showCacheIndicator} />

      {/* Goal Animation Overlay */}
      <GoalAnimation
        goalEvent={lastGoalEvent}
        onAnimationComplete={clearLastGoalEvent}
        sportId={tournament?.sportId}
      />

      {/* Card Animation Overlay */}
      <CardAnimation
        cardEvent={lastCardEvent}
        onAnimationComplete={clearLastCardEvent}
      />

      {/* CSS for animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.95); }
        }

        @keyframes liveDotPulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.3);
            opacity: 0.8;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>
    </div>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const containerStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: displayColors.background,
  color: displayColors.textPrimary,
  fontFamily: 'Inter, system-ui, sans-serif',
};

const backButtonStyle: CSSProperties = {
  marginTop: displaySpacing.sectionMD,
  padding: `${displaySpacing.contentMD} ${displaySpacing.contentXL}`,
  fontSize: displayFontSizes.bodyMD,
  background: displayColors.primary,
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
};

export default MonitorDisplayPage;
