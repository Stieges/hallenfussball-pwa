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
import { displayLayout, monitorThemes } from '../../design-tokens';
import type { TournamentMonitor } from '../../types/monitor';
import { PERFORMANCE_PROFILES, calculateCacheStatus } from '../../types/monitor';
import { useTranslation, I18nextProvider } from 'react-i18next';
import { ANZEIGE_SPRACHE, anzeigeI18n } from '../../i18n/anzeigeSprache';
import { GoalAnimation, CardAnimation } from '../../components/monitor';
import { WakeLockNotice } from '../../components/monitor/WakeLockNotice';
import { useWakeLock } from '../../hooks/useWakeLock';
import { vollbildUmschalten } from './vollbild';
import { useBildrand } from './useBildrand';
import { istCacheTaste, istEingabeZiel, istHinweisFolie, istVollbildTaste } from './monitorDauerbetrieb';
import { useWakeLockHinweis } from './useWakeLockHinweis';
import { useIdleCursor, useTastenAbfang, useWakeLockNachEingabe } from './useMonitorDauerbetrieb';
import {
  alleUebersprungen, liveSpielLaeuft, selectDisplayableSlides, SPIELPLAN_FALLBACK_SLIDE, ZUSCHAUER_QR_SLIDE, type SlideProgram,
} from './slideProgramme';
import { isSlideShowable } from './publicVisibility';
import { monitorPageCount } from './slideContent';
import { buildMonitorRuleMatches, buildMonitorView, monitorJetztMs } from './monitorView';
import { useSlideshow } from './useSlideshow';
import { useReloadGate } from './useReloadGate';
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

  const view = useMemo(() => (tournament === null ? null : buildMonitorView(tournament)), [tournament]); // gemeinsame Ansicht (A-36c)
  // Live match events for animations (einzige Stelle mit useLiveMatches)
  // B-16e2 (@ZM-118): Kindermodus – keine Tor- oder Karten-Einblendung
  const ergebnisseAusgeblendet = view !== null && !view.rules.results;
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
  const ansichtBereit = !loading && !error && tournament !== null && monitor !== null;

  // Derived state
  const performanceSettings = useMemo(
    () => monitor ? getPerformanceSettings(monitor.performanceMode) : PERFORMANCE_PROFILES.high,
    [monitor]
  );

  const cacheStatus = useMemo(
    () => calculateCacheStatus(lastFetch),
    [lastFetch]
  );

  // Bildrand in Prozent (@ME-067, @ME-020, `?rand=`) und Anti-Burn-in-Verschiebung für OLED/Plasma
  const { overscanPercent, pixelShift, sichererBereich } = useBildrand(monitor, performanceSettings);

  // Darstellbare Folien (@OB-011): Folien ohne Darstellung werden übersprungen,
  // bleibt keine übrig (auch beim leeren Programm), gilt die Zuschauer-QR-Folie.
  // F-04: Ist kein QR möglich (nicht öffentlich/ohne Share-Code), nimmt der Monitor
  // die nächste immer darstellbare Folie (Spielplan) — der Bildschirm ist nie leer.
  const qrMoeglich = tournament?.isPublic === true && Boolean(tournament?.shareCode);
  // B-16e2 (@ZM-090): Bei ausgeblendeten Ergebnissen fallen wertende Folien weg (Rückfall: QR)
  const slides = useMemo(
    () => selectDisplayableSlides(monitor?.slides ?? [], { qrMoeglich, isShowable: (slide) => view === null || isSlideShowable(slide, view.rules) }),
    [monitor, qrMoeglich, view]
  );
  // Rückfall (B-16e1 Ruling, @ZM-122): Sind alle Live-Folien ohne Spiel, zeigt die Seite QR bzw. Spielplan.
  // Nur ohne Pin: Während eines Spiels und der 30-s-Haltezeit (@ZM-077) bleibt die Live-Folie sichtbar.
  const rueckfallFolie = qrMoeglich ? ZUSCHAUER_QR_SLIDE : SPIELPLAN_FALLBACK_SLIDE;

  // Folienfolge (B-16c): Takt und Übergang liegen in useSlideshow. Tasten wirken nicht (@ME-022).
  const defaultSlideDuration = monitor?.defaultSlideDuration ?? 15;
  // Spiele für die Anhalte- und Feldregeln (B-16e1) samt Vorlaufzeit (@ZM-138): jede neue Turnier-Referenz wertet die Regeln aus.
  const ansichtZeitMs = useMemo(() => (view === null ? 0 : monitorJetztMs()), [view]);
  const ruleMatches = useMemo(
    () => (view === null || tournament === null ? undefined : buildMonitorRuleMatches(view, tournament)),
    [view, tournament]
  );
  const slideProgram = useMemo<SlideProgram>(
    () => ({
      slides,
      defaultDurationSec: defaultSlideDuration,
      matches: ruleMatches,
      pageCount: (slide) => monitorPageCount(slide, tournament, view),
    }),
    [slides, defaultSlideDuration, tournament, view, ruleMatches]
  );
  const transitionMs = performanceSettings.enableTransitions && monitor?.transition !== 'none'
    ? (monitor?.transitionDuration ?? 0)
    : null;
  const { slideState } = useSlideshow(slideProgram, transitionMs);
  // Neue App-Version nur zwischen Spielen (B-19b, @ZM-124, @ME-012): das Neulade-Tor der Kiosk-Seite.
  useReloadGate(slideProgram.slides, slideProgram.matches, slideState.currentIndex);

  // Tor-Einblendung nach Feld der Live-Folien (B-16e1, @ZM-083)
  const boundFields = useMemo(() => boundFieldNumbers(monitor?.slides ?? []), [monitor]);

  // Current slide
  const currentSlide = useMemo(() => {
    const rueckfallAktiv = slideState.pinnedMatchId === null
      && alleUebersprungen(slides, ruleMatches ?? [], ansichtZeitMs);
    return rueckfallAktiv ? rueckfallFolie : slides[slideState.currentIndex] ?? null;
  }, [slides, slideState.currentIndex, slideState.pinnedMatchId, rueckfallFolie, ruleMatches, ansichtZeitMs]);

  // B-17 (@ME-006): 10-s-Hinweis als Ecke, nur ohne laufendes Spiel auf dem Feld (Regeln in useWakeLockHinweis)
  // und nur auf den Ersatzfolien, solange gar kein Programm eingerichtet ist (monitor.slides leer), bzw. einer QR-Folie des Programms
  const spielLaeuft = liveSpielLaeuft(slides, view?.matches ?? []);
  const hinweisPhase = useWakeLockHinweis(wakeLock.status, ansichtBereit, spielLaeuft);
  const hinweisZeigt = hinweisPhase && istHinweisFolie(currentSlide, monitor?.slides.length === 0 ? slides : monitor?.slides ?? []);

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

  if (error || !tournament || !monitor || !view) {
    return <MonitorErrorView error={error} onBack={onBack} />;
  }

  return (
    <div style={{ ...containerStyle, containerType: 'size', cursor: cursorRuht ? 'none' : undefined }}>
      {/* Slide Container — pixelShift for OLED anti-burn-in */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        // Größen-Container: der Bildrand in cqh/cqw bezieht sich auf die Folienfläche
        containerType: 'size',
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
              view={view}
              performanceSettings={performanceSettings}
              theme={monitor.theme}
              overscanPercent={overscanPercent}
              hinweisHoehe={hinweisZeigt ? displayLayout.noticeHeight : undefined}
              pinnedMatchId={slideState.pinnedMatchId}
              page={slideState.page}
            />
          </TransitionWrapper>
        )}
      </div>

      {/* Positionspunkte und Hinweis (nur im normalen Browser, einmal, B-17) liegen im sicheren Bereich (@ME-067) */}
      <div style={sichererBereich}>
        {slides.length > 1 && (
          <SlideDots count={slides.length} currentIndex={slideState.currentIndex} enableTransitions={performanceSettings.enableTransitions} />
        )}
        {hinweisZeigt && (
          <WakeLockNotice text={t('dauerbetrieb.wakeLockHint')} themeColors={monitorThemes[resolveTheme(monitor.theme)]} />
        )}
      </div>

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
