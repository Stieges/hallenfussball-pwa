/**
 * StatusPille – ein Eintrag der Statuszeile (G6, @HT-045): Symbol und Wort in einer Pille, antippbar (Tippfläche mindestens
 * `touchTargets.minimum`, @OB-022). Der Zustand steht nie nur in der Farbe: das Symbol und das Wort stehen immer dabei, die
 * Randart (`fest` oder `gestrichelt`) unterscheidet zusätzlich. Ton-Tokens wie `TextTag`/`StateMark`. Text bricht um, nie „…“.
 * Fachfrei: Symbol, Wort und Ziel bestimmt der Aufrufer. `lesetext` ist der ausgeschriebene Name für Vorlesehilfen, wenn das
 * Wort gekürzt ist („Feld 1 bereit“ statt „Lautsprecher Feld 1 bereit“).
 * Ohne `aktion` ist es eine reine Zustandsmarke (Karte je Feld): gleiche Töne und Randarten, kein Klickziel, kleinerer Radius.
 * Navigieren führt der Aufrufer aus (`onNavigiere`, im Gastgeber `navigate()`); dieser Baustein kennt den Router nicht.
 */
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { cssVars } from '../../../design-tokens';

export type StatusPilleTon = 'ok' | 'warn' | 'info' | 'neutral';
export type StatusPilleRand = 'fest' | 'gestrichelt';
export type StatusPilleAktion = { art: 'navigiere'; ziel: string } | { art: 'ausloesen'; onClick: () => void };

export interface StatusPilleProps {
  ton: StatusPilleTon;
  /** Symbol vor dem Wort (dekorativ, `aria-hidden`). */
  symbol: ReactNode;
  children: ReactNode;
  rand?: StatusPilleRand;
  /** Ohne Aktion: reine Zustandsmarke. */
  aktion?: StatusPilleAktion;
  /** Führt `aktion.art === 'navigiere'` aus. */
  onNavigiere?: (ziel: string) => void;
  /** Ausgeschriebener Name für Vorlesehilfen (ersetzt den sichtbaren Text beim Vorlesen). */
  lesetext?: string;
  /** Für die Pille „+n weitere“, die eine Liste aufklappt. */
  'aria-expanded'?: boolean;
  'data-testid'?: string;
}

const TONEN: Record<StatusPilleTon, { border: string; symbol: string; tint?: string; strong: boolean }> = {
  ok: { border: cssVars.colors.borderControl, symbol: cssVars.colors.primary, strong: false },
  neutral: { border: cssVars.colors.borderControl, symbol: cssVars.colors.textSecondary, strong: false },
  warn: { border: cssVars.colors.warningSolid, symbol: cssVars.colors.warningSolid, tint: cssVars.colors.warningLight, strong: true },
  info: { border: cssVars.colors.info, symbol: cssVars.colors.info, tint: cssVars.colors.infoLight, strong: true },
};

export function StatusPille({ ton, symbol, children, rand = 'fest', aktion, onNavigiere, lesetext, 'aria-expanded': expanded, 'data-testid': testId }: StatusPilleProps): ReactElement {
  const look = TONEN[ton];
  const gestrichelt = rand === 'gestrichelt';
  const antippbar = aktion !== undefined;
  const stil: CSSProperties = {
    display: 'inline-flex',
    alignItems: antippbar ? 'center' : 'flex-start',
    gap: cssVars.spacing.xs,
    boxSizing: 'border-box',
    maxWidth: '100%',
    minHeight: antippbar ? cssVars.touchTargets.minimum : undefined,
    padding: antippbar ? `0 ${cssVars.spacing.sm}` : `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    border: `${look.strong || gestrichelt ? cssVars.borderWidth.medium : cssVars.borderWidth.thin} ${gestrichelt ? 'dashed' : 'solid'} ${look.border}`,
    borderRadius: antippbar ? cssVars.borderRadius.full : cssVars.borderRadius.md,
    backgroundColor: cssVars.colors.background,
    backgroundImage: look.tint === undefined ? undefined : `linear-gradient(${look.tint}, ${look.tint})`,
    color: cssVars.colors.textPrimary, // Text bleibt textPrimary (Kontrast), Farbe trägt nur Rand und Symbol
    fontFamily: 'inherit',
    fontSize: cssVars.fontSizes.md,
    lineHeight: cssVars.lineHeights.bodySm,
    fontWeight: cssVars.fontWeights.semibold,
    textAlign: 'left',
    overflowWrap: 'break-word',
    cursor: antippbar ? 'pointer' : undefined,
  };
  const zeichen = (
    <span style={{ display: 'flex', flex: 'none', gap: cssVars.spacing.xs, color: look.symbol }} aria-hidden="true">{symbol}</span>
  );
  const wort = <span style={{ minWidth: 0, padding: antippbar ? `${cssVars.spacing.xs} 0` : undefined }}>{children}</span>;
  if (aktion === undefined) {
    return (
      <span style={stil} data-testid={testId} data-ton={ton} data-rand={rand}>
        {zeichen}
        {wort}
      </span>
    );
  }
  const ausfuehren = () => {
    if (aktion.art === 'ausloesen') { aktion.onClick(); } else { onNavigiere?.(aktion.ziel); }
  };
  return (
    <button type="button" style={stil} onClick={ausfuehren} aria-label={lesetext} aria-expanded={expanded} data-testid={testId} data-ton={ton} data-rand={rand} data-aktion={aktion.art}>
      {zeichen}
      {wort}
    </button>
  );
}
