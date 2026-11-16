/**
 * AusgangOptionen – die Wahlfelder der Liste „Ausgang“ (H4-11; @HT-053, @HT-054): je Ausgang ein Feld von mindestens 44 px mit Kreis, Name und
 * Marken als Wort („gewählt“, „nicht verbunden“, „virtuell“, Bluetooth-Hinweis); die Farbe trägt nie allein. Der Name steht nur als sichtbarer Text:
 * weder Name noch Kennung in `data-testid`, `id`, `aria-label` oder `title` (sie landen sonst in den Brotkrumen der Fehlerberichte). Nur Darstellung.
 */
import type { CSSProperties, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Icons } from '../../../components/ui/Icons';
import type { AusgangOption } from './baueAusgangOptionen';

export interface AusgangOptionenProps {
  optionen: readonly AusgangOption[];
  onWaehle: (option: AusgangOption) => void;
  darfAendern: boolean;
}

const listeStil: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.xs };
const kreisStil: CSSProperties = { display: 'inline-flex', flex: 'none', alignItems: 'center', justifyContent: 'center', width: cssVars.iconSizes.sm, height: cssVars.iconSizes.sm, marginTop: cssVars.spacing.xs, border: `${cssVars.borderWidth.medium} solid ${cssVars.colors.borderControl}`, borderRadius: cssVars.borderRadius.full };
const markenStil: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: cssVars.spacing.xs };
const markeStil: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: cssVars.spacing.xs, padding: `0 ${cssVars.spacing.xs}`, border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`, borderRadius: cssVars.borderRadius.sm, fontSize: cssVars.fontSizes.sm, fontWeight: cssVars.fontWeights.semibold };

function Option({ o, onWaehle, darfAendern }: { o: AusgangOption; onWaehle: (o: AusgangOption) => void; darfAendern: boolean }): ReactElement {
  const { t } = useTranslation('hallenton');
  const stil: CSSProperties = {
    display: 'flex', alignItems: 'flex-start', gap: cssVars.spacing.sm, width: '100%', boxSizing: 'border-box', minHeight: cssVars.touchTargets.minimum, padding: cssVars.spacing.sm,
    textAlign: 'left', fontFamily: 'inherit', color: cssVars.colors.textPrimary, cursor: darfAendern ? 'pointer' : 'default',
    border: `${o.gewaehlt ? cssVars.borderWidth.medium : cssVars.borderWidth.thin} ${o.fehlt ? 'dashed' : 'solid'} ${o.fehlt ? cssVars.colors.warningSolid : o.gewaehlt ? cssVars.colors.primary : cssVars.colors.borderControl}`,
    borderRadius: cssVars.borderRadius.md,
    backgroundColor: cssVars.colors.background,
    backgroundImage: o.fehlt ? `linear-gradient(${cssVars.colors.warningLight}, ${cssVars.colors.warningLight})` : o.gewaehlt ? `linear-gradient(${cssVars.colors.primaryLight}, ${cssVars.colors.primaryLight})` : undefined,
  };
  return (
    <button type="button" role="radio" aria-checked={o.gewaehlt} disabled={!darfAendern} style={stil} onClick={() => onWaehle(o)} data-testid={`ausgang-wahl-${o.index}`} data-fehlt={o.fehlt ? 'true' : undefined}>
      <span style={kreisStil} aria-hidden="true">{o.gewaehlt ? <Icons.Check size={iconSizeValues.xs} color={cssVars.colors.primary} /> : null}</span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: cssVars.spacing.xs, minWidth: 0 }}>
        <span style={{ fontSize: cssVars.fontSizes.md, lineHeight: cssVars.lineHeights.bodyMd, fontWeight: o.gewaehlt ? cssVars.fontWeights.bold : cssVars.fontWeights.semibold, overflowWrap: 'anywhere' }}>{o.name ?? t('ausgang.standard')}</span>
        {o.bluetooth ? <span style={{ color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm }}>{t('ausgang.bluetooth')}</span> : null}
        {o.gewaehlt || o.fehlt || o.virtuell ? (
          <span style={markenStil}>
            {o.gewaehlt && !o.fehlt ? <span style={{ ...markeStil, borderColor: cssVars.colors.primary }}>{t('ausgang.gewaehlt')}</span> : null}
            {o.fehlt ? <span style={markeStil}><span aria-hidden="true" style={{ display: 'flex', color: cssVars.colors.warningSolid }}><Icons.AlertTriangle size={iconSizeValues.xs} /></span>{t('ausgang.nichtVerbunden')}</span> : null}
            {o.virtuell ? <span style={markeStil}>{t('ausgang.virtuell')}</span> : null}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export function AusgangOptionen({ optionen, onWaehle, darfAendern }: AusgangOptionenProps): ReactElement {
  const { t } = useTranslation('hallenton');
  return (
    <div role="radiogroup" aria-label={t('ausgang.liste')} style={listeStil} data-testid="ausgang-liste">
      {optionen.map((o) => <Option key={o.index} o={o} onWaehle={onWaehle} darfAendern={darfAendern} />)}
    </div>
  );
}
