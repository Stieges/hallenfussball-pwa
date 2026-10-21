/**
 * TeamKopf – Kopf einer Team-Spalte: Streifen in der Teamfarbe, „Heim/Gast“ und der Name darunter (Scheibe 3, Aufgabe 3.3; @OB-025).
 * Gemeinsam für die Tastenspalte (`TeamColumn`) und die Zusammenfassung nach dem Abpfiff (`TeamSummary`, B-10a2), damit der Name in beiden
 * gleich umbricht: nie getrennt, kleiner statt gekürzt (VISUAL-DESIGN § 1/§ 2). Kennungen `team-head-`, `team-stripe-`, `team-name-<Seite>`.
 */
import type { CSSProperties, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import type { Side } from '../model/cockpitTypes';

export interface TeamKopfProps {
  seite: Side;
  name: string;
  farbe: string | null;
  /** Ab 1024 px größere Schrift im Kopf. */
  breit?: boolean;
}

// Kopf nach Mockup: umrandet, oben Streifen und „Heim/Gast“, darunter der Name (@OB-025). Mindesthöhe für drei Namenszeilen, damit
// beide Köpfe gleich hoch sind und die Tor-Knöpfe auf einer Höhe stehen. Der Name wird nie gekürzt und nie getrennt (VISUAL-DESIGN § 1/§ 2).
const kopfStil: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: cssVars.spacing.xs, boxSizing: 'border-box', minWidth: 0,
  padding: cssVars.spacing.xs,
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`, borderRadius: cssVars.borderRadius.md,
  hyphens: 'manual',
};
const zeileStil: CSSProperties = { display: 'flex', alignItems: 'center', gap: cssVars.spacing.sm };
const nameStil = (breit: boolean): CSSProperties => ({
  margin: 0, hyphens: 'manual', overflowWrap: 'anywhere', lineHeight: cssVars.lineHeights.bodyMd,
  // Kleiner statt kürzen: eine Stufe zwischen mittel und groß, damit der Name in höchstens drei Zeilen passt
  fontSize: breit ? cssVars.fontSizes.titleMd : `clamp(${cssVars.fontSizes.md}, 4vw, ${cssVars.fontSizes.lg})`,
  fontWeight: cssVars.fontWeights.bold, color: cssVars.colors.textPrimary,
});
const streifenStil = (farbe: string | null): CSSProperties => ({
  flex: 1, height: cssVars.sizing.teamStripeWidth, background: farbe ?? cssVars.colors.border, borderRadius: cssVars.borderRadius.sm,
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderSolid}`,
});
const seiteStil: CSSProperties = { fontSize: cssVars.fontSizes.labelSm, color: cssVars.colors.textMuted, textTransform: 'uppercase' };

export function TeamKopf({ seite, name, farbe, breit = false }: TeamKopfProps): ReactElement {
  const { t } = useTranslation('cockpit');
  return (
    <div style={kopfStil} data-testid={`team-head-${seite}`}>
      <div style={zeileStil}>
        <span data-testid={`team-stripe-${seite}`} style={streifenStil(farbe)} />
        <span style={seiteStil}>{t(seite === 'home' ? 'spalte.heim' : 'spalte.gast')}</span>
      </div>
      <p data-teamname="" data-testid={`team-name-${seite}`} style={nameStil(breit)}>{name}</p>
    </div>
  );
}
