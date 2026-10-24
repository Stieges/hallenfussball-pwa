/**
 * PenaltyCard – eine laufende Zeitstrafe als Karte am Laptop (Plan Cockpit v2 B3, @SL-186, Mockup `haupt-720`).
 *
 * Randstreifen in der Teamfarbe des Ergebniskastens (Weste bei Leibchen), große Restzeit mit dem Etikett darüber, rechts Team und Nummer,
 * darunter Dauer und Spielzeit des Beginns, unten ein Balken, der mit der Restzeit abnimmt (Warnfarbe, nie Rot). Reine Anzeige: alle Texte
 * kommen fertig; Namen brechen um, nie „…“ (VISUAL-DESIGN § 1).
 */
import type { CSSProperties, ReactElement } from 'react';
import type { BoxFill } from '../../../core/models/scoreBoxColors';
import { cssVars } from '../../../design-tokens';
import { fillSurface } from './scoreBoxStyle';

export interface PenaltyCardProps {
  /** „Restzeit“ */
  etikett: string;
  /** „1:12“ */
  rest: string;
  /** „DJK Otting, Nr. 9“ */
  titel: string;
  /** „Zeitstrafe 2 Min · seit Spielzeit 3:18“ */
  unterzeile: string;
  /** Anteil, der noch zu verbüßen ist (0 bis 1) */
  anteil: number;
  fill: BoxFill;
  testId: string;
}

const karte: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.xs, minWidth: 0 };
const zeile: CSSProperties = { display: 'grid', gridTemplateColumns: `${cssVars.spacing.sm} auto minmax(0, 1fr)`, gap: cssVars.spacing.md, alignItems: 'center', minWidth: 0 };
const etikettStil: CSSProperties = {
  display: 'block', fontSize: cssVars.fontSizes.labelMd, lineHeight: cssVars.lineHeights.bodySm, fontWeight: cssVars.fontWeights.semibold,
  color: cssVars.colors.textSecondary, letterSpacing: cssVars.letterSpacing.wider, textTransform: 'uppercase',
};
const restStil: CSSProperties = {
  fontSize: 'var(--cockpit-strafe-ziffer, var(--font-size-display-md))', lineHeight: 1, fontWeight: cssVars.fontWeights.bold, fontVariantNumeric: 'tabular-nums', color: cssVars.colors.textPrimary,
};
const titelStil: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.lg, lineHeight: cssVars.lineHeights.bodyMd, fontWeight: cssVars.fontWeights.bold, overflowWrap: 'break-word', hyphens: 'manual', color: cssVars.colors.textPrimary };
const unterStil: CSSProperties = { display: 'block', fontSize: cssVars.fontSizes.md, lineHeight: cssVars.lineHeights.bodyMd, fontWeight: cssVars.fontWeights.normal, color: cssVars.colors.textSecondary };
const spur: CSSProperties = { height: cssVars.spacing.sm, borderRadius: cssVars.borderRadius.sm, overflow: 'hidden', background: cssVars.colors.border };

export function PenaltyCard({ etikett, rest, titel, unterzeile, anteil, fill, testId }: PenaltyCardProps): ReactElement {
  const gefuellt = Math.max(0, Math.min(1, anteil));
  const streifen: CSSProperties = { alignSelf: 'stretch', minHeight: cssVars.spacing.lg, borderRadius: cssVars.borderRadius.sm, border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderSolid}`, ...fillSurface(fill) };
  return (
    <div style={karte} data-testid={testId} data-anteil={gefuellt.toFixed(3)}>
      <div style={zeile}>
        <span style={streifen} data-testid={`${testId}-streifen`} aria-hidden="true" />
        <span>
          <span style={etikettStil}>{etikett}</span>
          <span style={restStil} data-testid={`${testId}-rest`}>{rest}</span>
        </span>
        <span style={{ minWidth: 0 }}>
          <p style={titelStil} data-teamname="" data-testid={`${testId}-titel`}>{titel}</p>
          <span style={unterStil}>{unterzeile}</span>
        </span>
      </div>
      <div style={spur} aria-hidden="true">
        <div style={{ height: '100%', width: `${(gefuellt * 100).toFixed(2)}%`, background: cssVars.colors.warning }} />
      </div>
    </div>
  );
}
