/**
 * VerbindungsStatus – Zustand der Verbindung (Plan LT-2, @SL-140, @SL-168).
 *
 * Zustandspunkt + Wort („Online“/„Offline“), nie Farbe allein (WCAG 1.4.1). Ohne Netz optional „N Einträge warten“ und der Knopf
 * „Verbinden“ (nur wenn `onVerbinden` übergeben ist); nach der Rückkehr kurz „Wieder verbunden“ (`wiederVerbunden`). Die Variante
 * `kompakt` (schmaler Kopf am Handy) zeigt mit Netz nur den Punkt; der zugängliche Name bleibt das Wort. Fachfrei: Status, Zahl und
 * Handler kommen vom Aufrufer, alle Texte als `texte`. Nur Design-Tokens.
 */
import type { CSSProperties, ReactElement } from 'react';
import { cssVars } from '../../../design-tokens';

export interface VerbindungsStatusTexte {
  online: string;
  offline: string;
  verbinden: string;
  wiederVerbunden: string;
  /** „1 Eintrag wartet“ / „3 Einträge warten“ */
  wartend: (anzahl: number) => string;
}

export interface VerbindungsStatusProps {
  status: 'online' | 'offline';
  texte: VerbindungsStatusTexte;
  /** Anzahl wartender Einträge (nur ohne Netz sichtbar, wenn größer als 0). */
  wartende?: number;
  /** Ohne Netz: stößt die Verbindung und die Übertragung an. Ohne Handler kein Knopf. */
  onVerbinden?: () => void;
  /** Kurz nach der Rückkehr des Netzes. */
  wiederVerbunden?: boolean;
  variante?: 'normal' | 'kompakt';
  testId?: string;
}

const huelleStil = (online: boolean): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: cssVars.spacing.xs, flex: 'none',
  padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`, borderRadius: cssVars.borderRadius.full,
  fontSize: cssVars.fontSizes.sm, fontWeight: cssVars.fontWeights.medium,
  background: online ? cssVars.colors.successLight : cssVars.colors.warningBannerBg,
  border: `${cssVars.borderWidth.thin} solid ${online ? cssVars.colors.success : cssVars.colors.warningBannerBorder}`,
  color: cssVars.colors.textPrimary,
});
const punktStil = (online: boolean): CSSProperties => ({
  width: cssVars.spacing.sm, height: cssVars.spacing.sm, borderRadius: cssVars.borderRadius.full,
  background: online ? cssVars.colors.success : cssVars.colors.warning,
});
const knopfStil: CSSProperties = {
  minHeight: cssVars.touchTargets.minimum, minWidth: cssVars.touchTargets.minimum, padding: `0 ${cssVars.spacing.sm}`,
  background: cssVars.colors.surface, color: cssVars.colors.textPrimary, border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`,
  borderRadius: cssVars.borderRadius.md, fontFamily: 'inherit', fontSize: cssVars.fontSizes.sm, fontWeight: cssVars.fontWeights.medium, cursor: 'pointer',
};

export function VerbindungsStatus({ status, texte, wartende = 0, onVerbinden, wiederVerbunden = false, variante = 'normal', testId }: VerbindungsStatusProps): ReactElement {
  const online = status === 'online';
  const wort = online ? (wiederVerbunden ? texte.wiederVerbunden : texte.online) : texte.offline;
  // Kompakt und ruhig online: nur der Punkt, der Name bleibt das Wort
  const nurPunkt = variante === 'kompakt' && online && !wiederVerbunden;
  return (
    <span style={huelleStil(online)} role="status" aria-label={nurPunkt ? wort : undefined} data-testid={testId} data-status={status}>
      <span style={punktStil(online)} aria-hidden="true" />
      {!nurPunkt && wort}
      {!online && wartende > 0 && <span data-testid={testId && `${testId}-wartend`}>{texte.wartend(wartende)}</span>}
      {!online && onVerbinden && (
        <button type="button" style={knopfStil} data-testid={testId && `${testId}-verbinden`} onClick={onVerbinden}>{texte.verbinden}</button>
      )}
    </span>
  );
}
