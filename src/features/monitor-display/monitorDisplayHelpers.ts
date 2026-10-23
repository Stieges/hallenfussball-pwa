/**
 * Monitor-Hilfsfunktionen (B-16d1): Theme, Performance-Profil, Feldnummer, Gruppenname, URL-Prüfung.
 * Reine Verschiebung aus MonitorDisplayPage.tsx; Logik und Werte unverändert.
 */
import { anzeigeT } from '../../i18n/anzeigeSprache';
import type { Tournament } from '../../types/tournament';
import { PERFORMANCE_PROFILES } from '../../types/monitor';
import type { MonitorTheme, PerformanceSettings } from '../../types/monitor';

/**
 * Resolve auto theme based on system preference
 */
export function resolveTheme(theme: MonitorTheme): 'light' | 'dark' {
  if (theme === 'auto') {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  }
  return theme;
}

export function detectPerformanceMode(): 'high' | 'low' {
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

export function getPerformanceSettings(mode: 'auto' | 'high' | 'low'): PerformanceSettings {
  if (mode === 'auto') {
    return PERFORMANCE_PROFILES[detectPerformanceMode()];
  }
  return PERFORMANCE_PROFILES[mode];
}

/** Convert field ID to field number */
export function fieldIdToNumber(fieldId: string | undefined): number {
  if (!fieldId) {return 1;}
  const num = parseInt(fieldId.replace('field-', ''), 10);
  return isNaN(num) ? 1 : num;
}

/** Get group display name */
export function getGroupDisplayName(tournament: Tournament, groupId: string | undefined): string {
  if (!groupId) {return anzeigeT('sport:tournament.group');}
  const group = tournament.groups?.find(g => g.id === groupId);
  return group?.customName ?? anzeigeT('sport:tournament.groupWithLetter', { letter: groupId });
}

/**
 * Validates a URL to prevent XSS attacks
 * Only allows http/https protocols
 */
export function isValidUrl(url: string): boolean {
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
export function getSafeUrl(url: string | undefined, fallback: string): string {
  if (!url) {return fallback;}
  return isValidUrl(url) ? url : fallback;
}
