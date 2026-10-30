/**
 * ScoreBox – der Ergebniskasten einer Seite (Aufgabe 2.2 Spielanzeige, @ZM-140, @ZM-156, @ZM-160, @ZM-161).
 *
 * EIN Baustein für Monitor (`display`, `row`) und Spielkarte/Kopf (`compact`): Ziffer in der getragenen Farbe, bei Leibchen als
 * Weste (Mitte Leibchen, Streifen Trikot). Feste Plätze, die Größe hängt nie vom Zustand ab (@ZM-151): Ring als `outline` um
 * den Sieger, Pokal oben rechts, Leibchen-Zeichen oben links – beide absolut außerhalb der Ziffernfläche, nie über einer Ziffer.
 * Reine Anzeige: Farben kommen aus `resolveBoxColors`, Sieger/Pokal entscheidet der Aufrufer. `background` muss `#RRGGBB` sein
 * (die gedämpfte Verlierer-Farbe und der Ziffern-Kontrast werden daraus gerechnet).
 */
import type { ReactElement } from 'react';
import type { BoxFill } from '../../../core/models/scoreBoxColors';
import { cssVars } from '../../../design-tokens';
import { Icons } from '../Icons';
import {
  boxStyle,
  digitAreaStyle,
  digitColor,
  digitsStyle,
  frameOf,
  markStyle,
  needsStrongFrame,
  type FrameStrength,
  type ScoreBoxOutcome,
  type ScoreBoxSize,
} from './scoreBoxStyle';

const CUP_ICON_STROKE = 2.4;

export interface ScoreBoxProps {
  /** `null` = keine Ziffer (Kindermodus, 3.2) */
  score: number | null;
  fill: BoxFill;
  /** Monitor-Live | Monitor-Folienzeile | Spielkarte/Kopf (≥ touchTargets.minimum) */
  size: ScoreBoxSize;
  /** Hintergrund hinter dem Kasten, `#RRGGBB` */
  background: string;
  /** Rahmenfarbe bei zu wenig Kontrast (Textfarbe des Hintergrunds) */
  textColor: string;
  outcome?: ScoreBoxOutcome;
  /** Hauptfarbe der Anzeige (Ring, Pokal); nie Gold */
  ringColor?: string;
  /** Pokal oben rechts (Aufrufer entscheidet: Sieger in der Finalrunde) */
  cup?: boolean;
  /** Leibchen-Zeichen oben links */
  bib?: boolean;
  /** Rahmenbreite für beide Kästen gemeinsam (`pairFrameStrength`); ohne Angabe bestimmt der Kasten sie selbst */
  frameStrength?: FrameStrength;
  /** Zugänglicher Name des ganzen Kastens (Stand, Sieger, Leibchen); die Zeichen selbst sind dekorativ */
  ariaLabel: string;
  /** Kinder: `${testId}-digits`, `${testId}-cup`, `${testId}-bib` */
  testId: string;
}

/** Leibchen-Zeichen (Weste, Mockup `#i-vest`). */
function VestGlyph(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M9 3a3 3 0 0 0 6 0l6 3-2 5-3-1.2V21H8V9.8L5 11 3 6z" />
    </svg>
  );
}

export function ScoreBox({
  score,
  fill,
  size,
  background,
  textColor,
  outcome,
  ringColor = cssVars.colors.primary,
  cup = false,
  bib = false,
  frameStrength,
  ariaLabel,
  testId,
}: ScoreBoxProps): ReactElement {
  const marks = { background, textColor, ringColor };
  const frame = frameOf(fill, outcome, background, textColor, size, frameStrength);
  return (
    <span
      role="img"
      aria-label={ariaLabel}
      style={boxStyle({ fill, size, background, textColor, outcome, ringColor, frameStrength })}
      data-testid={testId}
      data-fill={fill.kind}
      data-color={fill.kind === 'vest' ? fill.center : fill.color}
      {...(fill.kind === 'vest' ? { 'data-stripes': fill.stripes } : {})}
      {...(outcome !== undefined ? { 'data-outcome': outcome } : {})}
      data-digit-color={digitColor(fill, outcome, background)}
      data-frame={frameStrength ?? (needsStrongFrame(fill, background, outcome) ? 'strong' : 'subtle')}
      data-frame-width={frame.width}
    >
      <span style={digitAreaStyle(size)}>
        {score !== null && (
          <span style={digitsStyle(size)} {...(size === 'display' ? { 'data-monitor': 'stand' } : {})} {...(size === 'cockpit' ? { 'data-ziffern': 'stand' } : {})} data-testid={`${testId}-digits`}>
            {score}
          </span>
        )}
      </span>
      {bib && (
        <span style={markStyle('bib', size, marks)} aria-hidden="true" data-testid={`${testId}-bib`}>
          <VestGlyph />
        </span>
      )}
      {cup && (
        <span style={markStyle('cup', size, marks)} aria-hidden="true" data-testid={`${testId}-cup`}>
          <Icons.Trophy size="1em" strokeWidth={CUP_ICON_STROKE} />
        </span>
      )}
    </span>
  );
}
