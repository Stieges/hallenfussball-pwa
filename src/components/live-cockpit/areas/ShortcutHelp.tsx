/**
 * ShortcutHelp – Übersicht der Tastenkürzel (Plan Cockpit v2 K1, @SL-153): Knopf „Tastenkürzel“ im schmalen Kopf und die Taste `?`.
 * Zeigt die Belegung für die links und rechts **angezeigten** Teams (nach „Seiten tauschen“ gilt die Anzeige, nicht Heim/Gast) und sagt,
 * dass in Eingabefeldern nichts auslöst und wie der Abpfiff per Tastatur geht (Knopf mit Tab wählen, Leertaste oder Eingabetaste etwa eine
 * Sekunde halten). Der Schalter zum Abschalten steht in den Einstellungen des Cockpits (@SL-189).
 */
import type { CSSProperties, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { Button } from '../../ui/Button';
import { DialogSurface } from '../../ui/molecules/DialogSurface';
import { istApple } from '../model/plattform';

export interface ShortcutHelpProps { isOpen: boolean; onClose: () => void }

const flaeche: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.md, padding: cssVars.spacing.lg };
const liste: CSSProperties = { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: `${cssVars.spacing.sm} ${cssVars.spacing.md}`, margin: 0, alignItems: 'center' };
const kbdStil: CSSProperties = {
  display: 'inline-block', minWidth: cssVars.spacing.lg, boxSizing: 'border-box', textAlign: 'center', padding: `0 ${cssVars.spacing.sm}`,
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`, borderRadius: cssVars.borderRadius.sm, fontFamily: 'inherit',
  fontSize: cssVars.fontSizes.md, fontWeight: cssVars.fontWeights.bold, color: cssVars.colors.textPrimary,
};
const notiz: CSSProperties = { margin: 0, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm, lineHeight: cssVars.lineHeights.bodyMd };

function plattform(): string {
  if (typeof navigator === 'undefined') { return ''; }
  const n = navigator as Navigator & { userAgentData?: { platform?: string } };
  return n.userAgentData?.platform ?? n.platform ?? '';
}

export function ShortcutHelp({ isOpen, onClose }: ShortcutHelpProps): ReactElement | null {
  const { t } = useTranslation('cockpit');
  if (!isOpen) { return null; }
  const zeilen: Array<[string, string]> = [
    [t('tasten.leertaste'), t('tasten.uhr')],
    ['1', t('tasten.torLinks')],
    ['2', t('tasten.torRechts')],
    ['F', t('tasten.foulLinks')],
    ['J', t('tasten.foulRechts')],
    [istApple(plattform()) ? t('tasten.rueckgaengigCmd') : t('tasten.rueckgaengigStrg'), t('tasten.rueckgaengig')],
    ['?', t('tasten.uebersicht')],
  ];
  return (
    <DialogSurface isOpen onClose={onClose} ariaLabel={t('tasten.titel')} testId="shortcut-help">
      <div style={flaeche}>
        <h2 style={{ fontSize: cssVars.fontSizes.lg, margin: 0 }}>{t('tasten.titel')}</h2>
        <dl style={liste}>
          {zeilen.map(([taste, wirkung]) => (
            <div key={taste} style={{ display: 'contents' }}>
              <dt><kbd style={kbdStil}>{taste}</kbd></dt>
              <dd style={{ margin: 0 }}>{wirkung}</dd>
            </div>
          ))}
        </dl>
        <p style={notiz}>{t('tasten.eingabefeld')}</p>
        <p style={notiz}>{t('tasten.abpfiff')}</p>
        <p style={notiz}>{t('tasten.abschalten')}</p>
        <Button variant="primary" onClick={onClose} style={{ minHeight: cssVars.touchTargets.minimum }}>{t('tasten.schliessen')}</Button>
      </div>
    </DialogSurface>
  );
}
