/**
 * FeldWahl – Auswahl des Felds im Live-Bereich (Plan LT-2, @OB-030, Zone 1 „die Turnierleitung wechselt über die Feldwahl“).
 *
 * Nur bei mehr als einem Feld; Name „Feld wählen, jetzt Feld N“. Steht im schmalen Kopf und – ohne Spiel auf dem Feld – über der Tafel.
 * Die Einträge nennen das steuernde Gerät („Feld 2: Tom (Handy)“, @HE-049, B-49).
 */
import { useTranslation } from 'react-i18next';
import type { CSSProperties, ReactElement } from 'react';
import { cssVars } from '../../../design-tokens';

export interface FeldWahlProps {
  felder: number;
  feld: number;
  onFeld: (n: number) => void;
  /** Wer ein Feld steuert (@HE-049, B-49): „Tom (Handy)“, `''` = dieses Gerät; ohne Eintrag nur „Feld N“. */
  halter?: Readonly<Record<number, string>>;
}

const feldStil: CSSProperties = {
  flex: 'none', minHeight: cssVars.touchTargets.minimum, minWidth: cssVars.touchTargets.minimum, padding: `0 ${cssVars.spacing.sm}`,
  background: cssVars.colors.surface, color: cssVars.colors.textPrimary, border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`,
  borderRadius: cssVars.borderRadius.md, fontFamily: 'inherit', fontSize: cssVars.fontSizes.lg, cursor: 'pointer', whiteSpace: 'nowrap',
  maxWidth: cssVars.sizing.feldwahlMax,
};

export function FeldWahl({ felder, feld, onFeld, halter = {} }: FeldWahlProps): ReactElement | null {
  const { t } = useTranslation('cockpit');
  if (felder <= 1) { return null; }
  // @HE-049 „Feld 2: Tom (Handy)“ in der Feldübersicht
  const text = (n: number): string => {
    const name = halter[n];
    if (name === undefined) { return t('rahmen.feld', { feld: n }); }
    return name === '' ? t('rahmen.feldDiesesGeraet', { feld: n }) : t('rahmen.feldHalter', { feld: n, name });
  };
  return (
    <select style={feldStil} data-testid="cockpit-feldwahl" aria-label={t('rahmen.feldAria', { feld })} value={feld} onChange={(e) => { onFeld(Number(e.target.value)); }}>
      {Array.from({ length: felder }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{text(n)}</option>)}
    </select>
  );
}
