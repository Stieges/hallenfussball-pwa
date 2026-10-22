/**
 * FeldWahl – Auswahl des Felds im Live-Bereich (Plan LT-2, @OB-030, Zone 1 „die Turnierleitung wechselt über die Feldwahl“).
 *
 * Nur bei mehr als einem Feld; Name „Feld wählen, jetzt Feld N“. Steht im schmalen Kopf und – ohne Spiel auf dem Feld – über der Tafel.
 */
import { useTranslation } from 'react-i18next';
import type { CSSProperties, ReactElement } from 'react';
import { cssVars } from '../../../design-tokens';

export interface FeldWahlProps {
  felder: number;
  feld: number;
  onFeld: (n: number) => void;
}

const feldStil: CSSProperties = {
  flex: 'none', minHeight: cssVars.touchTargets.minimum, minWidth: cssVars.touchTargets.minimum, padding: `0 ${cssVars.spacing.sm}`,
  background: cssVars.colors.surface, color: cssVars.colors.textPrimary, border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`,
  borderRadius: cssVars.borderRadius.md, fontFamily: 'inherit', fontSize: cssVars.fontSizes.lg, cursor: 'pointer', whiteSpace: 'nowrap',
  maxWidth: cssVars.sizing.feldwahlMax,
};

export function FeldWahl({ felder, feld, onFeld }: FeldWahlProps): ReactElement | null {
  const { t } = useTranslation('cockpit');
  if (felder <= 1) { return null; }
  return (
    <select style={feldStil} data-testid="cockpit-feldwahl" aria-label={t('rahmen.feldAria', { feld })} value={feld} onChange={(e) => { onFeld(Number(e.target.value)); }}>
      {Array.from({ length: felder }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{t('rahmen.feld', { feld: n })}</option>)}
    </select>
  );
}
