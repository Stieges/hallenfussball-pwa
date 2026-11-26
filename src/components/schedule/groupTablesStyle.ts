/**
 * Gemeinsame Stile und Hervorhebungen der Gruppentabellen (Desktop- und Handy-Ansicht): nur Tokens, keine festen Maße.
 * Aus `GroupTables.tsx` ausgelagert (Datei über 300 Zeilen); die Darstellung bleibt, die Maße kommen aus den Abstands-Tokens.
 */
import type { CSSProperties } from 'react';
import { cssVars } from '../../design-tokens';
import type { ScheduleSource } from './scheduleSource';

export const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: cssVars.fontSizes.md };

export const thStyle: CSSProperties = {
  background: cssVars.colors.primary,
  color: cssVars.colors.background,
  padding: `${cssVars.spacing.sm} ${cssVars.spacing.sm}`,
  textAlign: 'left',
  fontWeight: cssVars.fontWeights.semibold,
  fontSize: cssVars.fontSizes.sm,
};

export const tdStyle: CSSProperties = {
  padding: `${cssVars.spacing.sm} ${cssVars.spacing.sm}`,
  borderBottom: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
  color: cssVars.colors.textPrimary,
};

/** Handy (@ZM-088): Platz, Spiele, Differenz, Punkte und Pfeil nehmen nur so viel Breite wie ihr Inhalt, der Rest gehört der Teamspalte. */
export const mobileThStyle: CSSProperties = { ...thStyle, paddingLeft: cssVars.spacing.xs, paddingRight: cssVars.spacing.xs };
export const mobileTdStyle: CSSProperties = { ...tdStyle, paddingLeft: cssVars.spacing.xs, paddingRight: cssVars.spacing.xs };
export const mobileFixedColStyle: CSSProperties = { ...mobileThStyle, textAlign: 'center', whiteSpace: 'nowrap', width: '1%' };
/** Desktop (@OB-075): Spalten mit Kurzform im Kopf nehmen nur so viel Breite wie ihr Inhalt. */
export const fixedColStyle: CSSProperties = { ...thStyle, width: '1%', textAlign: 'center', whiteSpace: 'nowrap' };

export interface PlacementHighlights {
  points: boolean;
  wins: boolean;
  goalDiff: boolean;
  goalsFor: boolean;
  goalsAgainst: boolean;
}

/** Welche Spalten die Wertung hervorhebt (ohne Turnier: keine; der direkte Vergleich hat keine eigene Spalte). */
export function placementHighlights(tournament: ScheduleSource | undefined): PlacementHighlights {
  const enabled = tournament?.placementLogic?.filter((c) => c.enabled && c.id !== 'directComparison') ?? [];
  const has = (id: string): boolean => enabled.some((c) => c.id === id);
  return { points: has('points'), wins: has('wins'), goalDiff: has('goalDifference'), goalsFor: has('goalsFor'), goalsAgainst: has('goalsAgainst') };
}

/** Hervorhebung einer Zahl: Fläche der Wertung (`rankingHighlightBg`), sonst keine. */
export function highlightStyle(active: boolean): CSSProperties {
  return {
    padding: active ? `${cssVars.spacing.xs} ${cssVars.spacing.sm}` : '0',
    background: active ? cssVars.colors.rankingHighlightBg : 'transparent',
    borderRadius: active ? cssVars.borderRadius.sm : '0',
  };
}

/**
 * Farbe der Tordifferenz: Plus in der Hauptfarbe, Null gedämpft, Minus in einem dunkleren Rot (`rankingNegativeText`, mindestens 4,5 : 1 auch auf der
 * Wertungsfläche `rankingHighlightBg`; `error` schafft dort nur 4,4 : 1 hell und 3,7 : 1 dunkel). Das Minuszeichen trägt die Bedeutung zusätzlich (@ZM-205, WCAG 1.4.1/1.4.3).
 */
export function goalDiffColor(goalDiff: number): string {
  if (goalDiff > 0) { return cssVars.colors.primary; }
  if (goalDiff < 0) { return cssVars.colors.rankingNegativeText; }
  return cssVars.colors.textSecondary;
}

export const liveDotStyle: CSSProperties = {
  width: cssVars.spacing.sm,
  height: cssVars.spacing.sm,
  borderRadius: cssVars.borderRadius.full,
  backgroundColor: cssVars.colors.statusLive,
  animation: 'pulse-live 2s infinite',
  marginLeft: cssVars.spacing.xs,
  display: 'inline-block',
  flexShrink: 0,
};

/** Nur zum Vorlesen (Spaltenkopf der Aufklapp-Taste). */
export const hiddenStyle: CSSProperties = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' };
