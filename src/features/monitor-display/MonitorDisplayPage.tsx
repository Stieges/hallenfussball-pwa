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

import { useState, useEffect, useCallback, useMemo, useRef, CSSProperties } from 'react';
import {
  displayColors,
  displayFontSizes,
  displaySpacing,
  displayEffects,
  displayColorSchemes,
  monitorThemes,
  cssVars,
} from '../../design-tokens';
import type { Tournament, Match, Team } from '../../types/tournament';
import type {
  TournamentMonitor,
  MonitorSlide,
  TransitionType,
  PerformanceSettings,
  MonitorTheme,
} from '../../types/monitor';
import { PERFORMANCE_PROFILES, calculateCacheStatus, CacheStatus } from '../../types/monitor';
import { getAllTournaments } from '../../services/api';
import { calculateStandings } from '../../utils/calculations';
import { TeamAvatar } from '../../components/ui/TeamAvatar';
import { useLiveMatches } from '../../hooks/useLiveMatches';
import type { LiveMatch } from '../../hooks/useLiveMatches';
import { GoalAnimation, CardAnimation, LiveMatchDisplay } from '../../components/monitor';
import { generateTournamentUrl } from '../../utils/shareUtils';
import { QRCodeSVG } from 'qrcode.react';
import { usePixelShift } from '../../hooks/usePixelShift';
import { supabase } from '../../lib/supabase';

// =============================================================================
// THEME RESOLUTION
// =============================================================================

/**
 * Resolve auto theme based on system preference
 */
function resolveTheme(theme: MonitorTheme): 'light' | 'dark' {
  if (theme === 'auto') {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  }
  return theme;
}

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

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function detectPerformanceMode(): 'high' | 'low' {
  if (typeof window !== 'undefined') {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {return 'low';}

    const ua = navigator.userAgent.toLowerCase();
    const isSmartTV = ua.includes('smart-tv') ||
      ua.includes('smarttv') ||
      ua.includes('webos') ||
      ua.includes('tizen') ||
      ua.includes('hbbtv');
    if (isSmartTV) {return 'low';}
  }
  return 'high';
}

function getPerformanceSettings(mode: 'auto' | 'high' | 'low'): PerformanceSettings {
  if (mode === 'auto') {
    return PERFORMANCE_PROFILES[detectPerformanceMode()];
  }
  return PERFORMANCE_PROFILES[mode];
}

/** Convert field ID to field number */
function fieldIdToNumber(fieldId: string | undefined): number {
  if (!fieldId) {return 1;}
  const num = parseInt(fieldId.replace('field-', ''), 10);
  return isNaN(num) ? 1 : num;
}

/** Get team name from team ID or name */
function getTeamName(teams: Team[], teamIdOrName: string): string {
  const team = teams.find(t => t.id === teamIdOrName || t.name === teamIdOrName);
  return team?.name ?? teamIdOrName;
}

/** Get group display name */
function getGroupDisplayName(tournament: Tournament, groupId: string | undefined): string {
  if (!groupId) {return 'Gruppe';}
  const group = tournament.groups?.find(g => g.id === groupId);
  return group?.customName ?? `Gruppe ${groupId}`;
}

/**
 * Validates a URL to prevent XSS attacks
 * Only allows http/https protocols
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Sanitizes a URL - returns safe URL or fallback
 */
function getSafeUrl(url: string | undefined, fallback: string): string {
  if (!url) {return fallback;}
  return isValidUrl(url) ? url : fallback;
}

// =============================================================================
// SLIDE RENDERER COMPONENT
// =============================================================================

interface SlideRendererProps {
  slide: MonitorSlide;
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

    default:
      return (
        <div style={slideStyle}>
          <div style={{ fontSize: displayFontSizes.headingLG }}>
            Slide-Typ "{slide.type}" wird in Phase 2 implementiert
          </div>
        </div>
      );
  }
}

// =============================================================================
// LIVE SLIDE
// =============================================================================

/**
 * Convert Tournament Match + Team[] to LiveMatch format for LiveMatchDisplay.
 */
function toLiveMatch(match: Match, teams: Team[], tournament: Tournament): LiveMatch {
  const findTeam = (id: string) =>
    teams.find(t => t.id === id || t.name === id) ?? { id, name: id };

  const statusMap: Record<string, 'NOT_STARTED' | 'RUNNING' | 'PAUSED' | 'FINISHED'> = {
    running: 'RUNNING',
    finished: 'FINISHED',
    scheduled: 'NOT_STARTED',
    waiting: 'NOT_STARTED',
    skipped: 'FINISHED',
  };

  const durationMinutes = tournament.groupPhaseGameDuration ?? tournament.gameDuration ?? 8;

  // Derive referee name from referee number
  const refereeTeam = match.referee
    ? teams.find(t => t.name === `SR${match.referee}` || t.name === `Schiedsrichter ${match.referee}`)
    : undefined;

  return {
    id: match.id,
    number: match.matchNumber ?? match.round,
    phaseLabel: match.label ?? match.phase ?? 'Gruppenphase',
    fieldId: `field-${match.field}`,
    field: match.field,
    scheduledKickoff: match.scheduledTime ? new Date(match.scheduledTime).toISOString() : '',
    durationSeconds: durationMinutes * 60,
    refereeName: refereeTeam?.name,
    homeTeam: findTeam(match.teamA),
    awayTeam: findTeam(match.teamB),
    homeScore: match.scoreA ?? 0,
    awayScore: match.scoreB ?? 0,
    status: statusMap[match.matchStatus ?? 'scheduled'] ?? 'NOT_STARTED',
    elapsedSeconds: match.timerElapsedSeconds ?? 0,
    events: [],
    timerStartTime: match.timerStartTime,
    timerPausedAt: match.timerPausedAt,
    timerElapsedSeconds: match.timerElapsedSeconds,
    group: match.group,
  };
}

interface LiveSlideProps {
  slide: MonitorSlide;
  tournament: Tournament;
  performanceSettings: PerformanceSettings;
  theme: MonitorTheme;
  style: CSSProperties;
}

function LiveSlide({ slide, tournament, theme, style }: LiveSlideProps) {
  const resolvedTheme = resolveTheme(theme);
  const themeColors = monitorThemes[resolvedTheme];

  const fieldNumber = fieldIdToNumber(slide.config.fieldId);
  const field = tournament.fields?.find(f => f.id === slide.config.fieldId);
  const fieldName = field?.customName ?? field?.defaultName ?? `Feld ${fieldNumber}`;
  const { matches, teams } = tournament;

  // Find currently running match on this field
  const runningMatch = matches.find(
    m => m.field === fieldNumber && m.matchStatus === 'running'
  );

  // Find next scheduled match if no live match
  const nextMatch = !runningMatch
    ? matches.find(m => m.field === fieldNumber && (!m.matchStatus || m.matchStatus === 'scheduled'))
    : null;

  // Delegate to LiveMatchDisplay for running matches
  if (runningMatch) {
    const liveMatch = toLiveMatch(runningMatch, teams, tournament);
    return (
      <div style={style}>
        <LiveMatchDisplay
          match={liveMatch}
          group={runningMatch.group}
          fullscreen
          theme={theme}
          colorScheme={slide.config.liveColorScheme}
        />
      </div>
    );
  }

  // No live match - show next match or idle state based on whenIdle config
  const whenIdleType = slide.config.whenIdle?.type ?? 'next-match';
  const getTeamObject = (teamIdOrName: string) =>
    teams.find(t => t.id === teamIdOrName || t.name === teamIdOrName);

  return (
    <div style={style}>
      <div style={{
        fontSize: displayFontSizes.headingMD,
        color: themeColors.textSecondary,
        marginBottom: displaySpacing.sectionMD,
      }}>
        ⚽ {fieldName}
      </div>

      {whenIdleType === 'skip' ? (
        <div style={{
          fontSize: displayFontSizes.bodyLG,
          color: themeColors.textMuted,
        }}>
          Warte auf nächstes Spiel...
        </div>
      ) : nextMatch ? (
        (() => {
          const nextTeamA = getTeamObject(nextMatch.teamA);
          const nextTeamB = getTeamObject(nextMatch.teamB);
          return (
            <>
              <div style={{
                fontSize: displayFontSizes.bodyLG,
                color: themeColors.textMuted,
                marginBottom: displaySpacing.contentLG,
              }}>
                Nächstes Spiel
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: displaySpacing.sectionMD,
              }}>
                <div style={{ textAlign: 'center' }}>
                  {nextTeamA && (
                    <TeamAvatar team={nextTeamA} size="xxl" showColorRing />
                  )}
                  <div style={{
                    fontSize: displayFontSizes.headingMD,
                    color: themeColors.text,
                    marginTop: cssVars.spacing.md,
                  }}>
                    {getTeamName(teams, nextMatch.teamA)}
                  </div>
                </div>

                <div style={{
                  fontSize: displayFontSizes.headingLG,
                  color: themeColors.textMuted,
                  padding: `0 ${displaySpacing.contentLG}`,
                }}>
                  vs
                </div>

                <div style={{ textAlign: 'center' }}>
                  {nextTeamB && (
                    <TeamAvatar team={nextTeamB} size="xxl" showColorRing />
                  )}
                  <div style={{
                    fontSize: displayFontSizes.headingMD,
                    color: themeColors.text,
                    marginTop: cssVars.spacing.md,
                  }}>
                    {getTeamName(teams, nextMatch.teamB)}
                  </div>
                </div>
              </div>
            </>
          );
        })()
      ) : (
        <div style={{
          fontSize: displayFontSizes.bodyLG,
          color: themeColors.textMuted,
        }}>
          Kein Spiel geplant
        </div>
      )}
    </div>
  );
}

// =============================================================================
// STANDINGS SLIDE
// =============================================================================

interface StandingsSlideProps {
  slide: MonitorSlide;
  tournament: Tournament;
  theme: MonitorTheme;
  style: CSSProperties;
}

function StandingsSlide({ slide, tournament, theme, style }: StandingsSlideProps) {
  const resolvedTheme = resolveTheme(theme);
  const themeColors = monitorThemes[resolvedTheme];

  const groupId = slide.config.groupId;
  const groupName = getGroupDisplayName(tournament, groupId);
  const { teams, matches } = tournament;

  // Calculate standings for this group
  const standings = calculateStandings(teams, matches, tournament, groupId);

  return (
    <div style={style}>
      {/* Header */}
      <div style={{
        fontSize: displayFontSizes.headingLG,
        fontWeight: 600,
        marginBottom: displaySpacing.sectionMD,
        color: themeColors.text,
      }}>
        📊 {groupName}
      </div>

      {/* Table */}
      <div style={{
        width: '100%',
        maxWidth: '800px',
        background: themeColors.surface,
        borderRadius: '16px',
        padding: displaySpacing.contentLG,
        boxShadow: displayEffects.cardShadow,
        border: `1px solid ${themeColors.border}`,
      }}>
        {/* Table Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '48px 1fr 48px 48px 48px 64px 64px',
          gap: displaySpacing.inlineMD,
          padding: `${displaySpacing.contentSM} ${displaySpacing.contentMD}`,
          borderBottom: `1px solid ${themeColors.border}`,
          fontSize: displayFontSizes.bodySM,
          color: themeColors.textMuted,
          fontWeight: 500,
        }}>
          <div>#</div>
          <div>Team</div>
          <div style={{ textAlign: 'center' }}>S</div>
          <div style={{ textAlign: 'center' }}>U</div>
          <div style={{ textAlign: 'center' }}>N</div>
          <div style={{ textAlign: 'center' }}>Diff</div>
          <div style={{ textAlign: 'center' }}>Pkt</div>
        </div>

        {/* Table Rows */}
        {standings.map((row, idx) => (
          <div
            key={row.team.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '48px 1fr 48px 48px 48px 64px 64px',
              gap: displaySpacing.inlineMD,
              padding: `${displaySpacing.contentMD} ${displaySpacing.contentMD}`,
              borderBottom: idx < standings.length - 1 ? `1px solid ${themeColors.border}` : 'none',
              fontSize: displayFontSizes.bodyLG,
              color: themeColors.text,
            }}
          >
            <div style={{ fontWeight: 600 }}>{idx + 1}</div>
            <div style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {row.team.name}
            </div>
            <div style={{ textAlign: 'center', color: themeColors.progressBar }}>{row.won}</div>
            <div style={{ textAlign: 'center', color: themeColors.textSecondary }}>{row.drawn}</div>
            <div style={{ textAlign: 'center', color: themeColors.progressBarWarning }}>{row.lost}</div>
            <div style={{
              textAlign: 'center',
              color: row.goalDifference > 0
                ? themeColors.progressBar
                : row.goalDifference < 0
                  ? themeColors.progressBarWarning
                  : themeColors.textSecondary,
            }}>
              {row.goalDifference > 0 ? '+' : ''}{row.goalDifference}
            </div>
            <div style={{
              textAlign: 'center',
              fontWeight: 700,
              color: themeColors.score,
            }}>
              {row.points}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// SCHEDULE FIELD SLIDE
// =============================================================================

interface ScheduleFieldSlideProps {
  slide: MonitorSlide;
  tournament: Tournament;
  theme: MonitorTheme;
  style: CSSProperties;
}

function ScheduleFieldSlide({ slide, tournament, theme, style }: ScheduleFieldSlideProps) {
  const resolvedTheme = resolveTheme(theme);
  const themeColors = monitorThemes[resolvedTheme];

  const fieldNumber = fieldIdToNumber(slide.config.fieldId);
  const field = tournament.fields?.find(f => f.id === slide.config.fieldId);
  const fieldName = field?.customName ?? field?.defaultName ?? `Feld ${fieldNumber}`;
  const { matches, teams } = tournament;

  // Filter matches for this field
  const fieldMatches = matches
    .filter(m => m.field === fieldNumber)
    .slice(0, 6);

  const getStatusColor = (match: Match) => {
    switch (match.matchStatus) {
      case 'running': return themeColors.liveDot;
      case 'finished': return themeColors.progressBar;
      default: return themeColors.textMuted;
    }
  };

  return (
    <div style={style}>
      {/* Header */}
      <div style={{
        fontSize: displayFontSizes.headingLG,
        fontWeight: 600,
        marginBottom: displaySpacing.sectionMD,
        color: themeColors.text,
      }}>
        📋 Spielplan {fieldName}
      </div>

      {/* Match List */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: displaySpacing.contentMD,
        width: '100%',
        maxWidth: '900px',
      }}>
        {fieldMatches.map((match) => (
          <div
            key={match.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: displaySpacing.contentLG,
              padding: displaySpacing.contentLG,
              background: match.matchStatus === 'running' ? themeColors.surfaceHover : themeColors.surface,
              borderRadius: '12px',
              border: match.matchStatus === 'running' ? `2px solid ${themeColors.liveDot}` : `1px solid ${themeColors.border}`,
            }}
          >
            {/* Status Indicator */}
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: getStatusColor(match),
              flexShrink: 0,
            }} />

            {/* Team A */}
            <div style={{
              flex: 1,
              fontSize: displayFontSizes.bodyLG,
              color: themeColors.text,
              textAlign: 'right',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {getTeamName(teams, match.teamA)}
            </div>

            {/* Score */}
            <div style={{
              minWidth: '100px',
              textAlign: 'center',
              fontSize: displayFontSizes.bodyXL,
              fontWeight: 700,
              color: match.matchStatus === 'finished' ? themeColors.score : themeColors.textMuted,
            }}>
              {match.scoreA !== undefined && match.scoreB !== undefined
                ? `${match.scoreA}:${match.scoreB}`
                : '-:-'}
            </div>

            {/* Team B */}
            <div style={{
              flex: 1,
              fontSize: displayFontSizes.bodyLG,
              color: themeColors.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {getTeamName(teams, match.teamB)}
            </div>
          </div>
        ))}
      </div>
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
    ? displayColorSchemes[colorSchemeKey as keyof typeof displayColorSchemes]
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
  // State
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [monitor, setMonitor] = useState<TournamentMonitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slideState, setSlideState] = useState<SlideState>({
    currentIndex: 0,
    isTransitioning: false,
    direction: 'next',
  });
  const [isPaused, setIsPaused] = useState(false);
  const [lastFetch, setLastFetch] = useState<number>(Date.now());
  const [showCacheIndicator, setShowCacheIndicator] = useState(false);

  // Live match events for animations
  const {
    lastGoalEvent,
    clearLastGoalEvent,
    lastCardEvent,
    clearLastCardEvent,
  } = useLiveMatches(tournamentId);

  // Ref to track if a fetch is in progress (prevents race conditions)
  const isFetchingRef = useRef(false);

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

  // Current slide
  const currentSlide = useMemo(
    () => monitor?.slides[slideState.currentIndex] ?? null,
    [monitor, slideState.currentIndex]
  );

  // Slide duration
  const slideDuration = useMemo(
    () => (currentSlide?.duration ?? monitor?.defaultSlideDuration ?? 15) * 1000,
    [currentSlide, monitor]
  );

  // ==========================================================================
  // DATA LOADING
  // ==========================================================================

  const loadData = useCallback(async () => {
    // Prevent concurrent fetches (race condition fix)
    if (isFetchingRef.current) {
      return;
    }

    isFetchingRef.current = true;

    try {
      const tournaments = await getAllTournaments();
      const found = tournaments.find((t: Tournament) => t.id === tournamentId);

      if (!found) {
        setError(`Turnier nicht gefunden: ${tournamentId}`);
        setLoading(false);
        return;
      }

      const foundMonitor = found.monitors?.find((m: TournamentMonitor) => m.id === monitorId);
      if (!foundMonitor) {
        setError(`Monitor nicht gefunden: ${monitorId}`);
        setLoading(false);
        return;
      }

      setTournament(found);
      setMonitor(foundMonitor);
      setLastFetch(Date.now());
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
      setLoading(false);
    } finally {
      isFetchingRef.current = false;
    }
  }, [tournamentId, monitorId]);

  // Initial load
  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Periodic refresh
  useEffect(() => {
    if (!monitor) {return;}

    const interval = setInterval(() => {
      void loadData();
    }, performanceSettings.pollingInterval);

    return () => clearInterval(interval);
  }, [loadData, monitor, performanceSettings.pollingInterval]);

  // Heartbeat sender — every 30s so admin dashboard can show online status
  useEffect(() => {
    if (!monitor || !tournament) {
      return;
    }

    const sendHeartbeat = async () => {
      if (!supabase) {
        return;
      }
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- monitor_heartbeats not yet in generated types
        await (supabase as any).from('monitor_heartbeats').upsert({
          monitor_id: monitor.id,
          tournament_id: tournament.id,
          last_seen: new Date().toISOString(),
          slide_index: slideState.currentIndex,
          cache_status: cacheStatus.connectionStatus,
          user_agent: navigator.userAgent,
        }, { onConflict: 'monitor_id' });
      } catch {
        // Heartbeat failure is non-critical — silently ignore
      }
    };

    void sendHeartbeat();
    const interval = setInterval(() => void sendHeartbeat(), 30_000);
    return () => clearInterval(interval);
  }, [monitor, tournament, slideState.currentIndex, cacheStatus.connectionStatus]);

  // ==========================================================================
  // SLIDESHOW LOGIC
  // ==========================================================================

  const goToSlide = useCallback((index: number, direction: 'next' | 'prev') => {
    if (!monitor || monitor.slides.length === 0) {return;}

    const nextIndex = ((index % monitor.slides.length) + monitor.slides.length) % monitor.slides.length;

    if (performanceSettings.enableTransitions && monitor.transition !== 'none') {
      setSlideState(prev => ({ ...prev, isTransitioning: true, direction }));

      setTimeout(() => {
        setSlideState({
          currentIndex: nextIndex,
          isTransitioning: false,
          direction,
        });
      }, monitor.transitionDuration);
    } else {
      setSlideState({
        currentIndex: nextIndex,
        isTransitioning: false,
        direction,
      });
    }
  }, [monitor, performanceSettings.enableTransitions]);

  const nextSlide = useCallback(() => {
    goToSlide(slideState.currentIndex + 1, 'next');
  }, [goToSlide, slideState.currentIndex]);

  const prevSlide = useCallback(() => {
    goToSlide(slideState.currentIndex - 1, 'prev');
  }, [goToSlide, slideState.currentIndex]);

  // Auto-advance slides
  // nextSlide changes when slideState.currentIndex changes, which correctly
  // triggers a new timeout after each slide transition.
  useEffect(() => {
    if (isPaused || !monitor || monitor.slides.length <= 1) {return;}

    const timeout = setTimeout(nextSlide, slideDuration);
    return () => clearTimeout(timeout);
  }, [isPaused, monitor, slideDuration, nextSlide]);

  // ==========================================================================
  // KEYBOARD NAVIGATION
  // ==========================================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          nextSlide();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          prevSlide();
          break;
        case ' ':
          e.preventDefault();
          setIsPaused(p => !p);
          break;
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
  }, [nextSlide, prevSlide, onBack]);

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

  // No slides configured
  if (monitor.slides.length === 0) {
    return (
      <div style={containerStyle} data-testid="monitor-no-slides-state">
        <div style={{
          fontSize: displayFontSizes.headingLG,
          color: displayColors.textSecondary,
          marginBottom: displaySpacing.sectionMD,
        }}>
          📺 {monitor.name}
        </div>
        <div
          data-testid="monitor-no-slides-message"
          style={{
            fontSize: displayFontSizes.bodyLG,
            color: displayColors.textMuted,
          }}
        >
          Keine Slides konfiguriert.<br />
          Füge im Monitor-Konfigurator Slides hinzu.
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
      {monitor.slides.length > 1 && (
        <div style={{
          position: 'fixed',
          bottom: displaySpacing.contentLG,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: displaySpacing.inlineSM,
          zIndex: 100,
        }}>
          {monitor.slides.map((_, idx) => (
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
