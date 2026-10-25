/**
 * MatchStatusBadge – das Zustands-Abzeichen eines Spiels (Aufgabe 1.1 Spielanzeige, @OB-065, @OB-066, @OB-039).
 *
 * EIN Baustein für Spielkarte, Zuschauer-Seite, Monitor und (ab 1.3) Cockpit-Tafel: ein Wort je Zustand, nie eine Uhr,
 * nie nur Farbe oder Punkt. Live trägt den Puls-Punkt im eigenen Live-Rot. Ein geplantes Spiel zeigt statt des
 * Abzeichens seine Anstoßzeit; ohne Anstoß wird nichts gezeichnet. Reine Anzeige, keine Logik außer dem Wort.
 */
import type { CSSProperties, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { animations, cssVars, displayFontSizes } from '../../../design-tokens';
import { MATCH_BADGE_WORD_KEY, type MatchBadgeModel, type MatchBadgeState } from '../../../core/view/badge';
import { badgeColorsFor, badgeStyle, dotStyle, kickoffColorFor, type MatchStatusBadgeSize, type MatchStatusBadgeSurface, type MatchStatusBadgeTone } from './matchStatusBadgeStyle';

export interface MatchStatusBadgeProps {
  model: MatchBadgeModel;
  /** Spielkarte/Kopf | Monitor-Folienzeile | Monitor-Kopf (cqh aus `displayLayout.scoreArea.badge*`) */
  size: MatchStatusBadgeSize;
  /** Monitor-Themes; sonst die Farben der App (cssVars) */
  tone?: MatchStatusBadgeTone;
  /** Fläche: `scoreboard` auf der dunklen Cockpit-Tafel (nur „Ende“ und „ausgefallen“ weichen ab); Standard `app` */
  surface?: MatchStatusBadgeSurface;
  /** Vorgabe `match-status-badge`; die Anstoßzeit `match-kickoff` */
  testId?: string;
}

const PAUSE_STATES: ReadonlySet<MatchBadgeState> = new Set(['pause', 'halftime']);

/** Pausensymbol vor dem Wort (zwei Balken in der Schriftfarbe; Maße relativ zur Schrift). */
function PauseGlyph(): ReactElement {
  const glyph: CSSProperties = { width: '1em', height: '1em', flexShrink: 0 };
  return (
    <svg viewBox="0 0 12 12" style={glyph} aria-hidden="true" focusable="false" fill="currentColor">
      <rect x="2.5" y="2" width="2.5" height="8" rx="0.5" />
      <rect x="7" y="2" width="2.5" height="8" rx="0.5" />
    </svg>
  );
}

export function MatchStatusBadge({ model, size, tone, surface = 'app', testId }: MatchStatusBadgeProps): ReactElement | null {
  const { t } = useTranslation('tournament');
  if (model.kind === 'none') {
    return null;
  }
  if (model.kind === 'kickoff') {
    const style: CSSProperties = {
      fontSize: size === 'display' ? displayFontSizes.liveBadge : cssVars.fontSizes.sm,
      lineHeight: cssVars.lineHeights.bodySm,
      fontWeight: cssVars.fontWeights.bold,
      fontVariantNumeric: 'tabular-nums',
      whiteSpace: 'nowrap',
      color: kickoffColorFor(surface),
    };
    return <span style={style} data-testid={testId ?? 'match-kickoff'}>{model.time}</span>;
  }
  const { state } = model;
  const live = state === 'live';
  return (
    <span
      style={badgeStyle(state, size, tone, surface)}
      data-testid={testId ?? 'match-status-badge'}
      data-state={state}
      {...(live ? { 'data-pulse': 'true' } : {})}
    >
      {live && (
        <span
          style={{ ...dotStyle(size, surface === 'scoreboardFlach' ? cssVars.colors.scoreboardOk : badgeColorsFor(state, tone, surface).fg), animation: animations.pulse }}
          aria-hidden="true"
          data-testid="match-status-badge-dot"
        />
      )}
      {PAUSE_STATES.has(state) && <PauseGlyph />}
      {t(MATCH_BADGE_WORD_KEY[state])}
    </span>
  );
}
