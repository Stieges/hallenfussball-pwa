/**
 * GeraetSchalter – Gerätename, Schalter „Dieses Gerät ist Hallen-Lautsprecher für Feld …“ und Feldwahl (H4-9; @HT-001, @HT-002, @HT-021).
 * Nur Darstellung mit Props. Der Schalter ist eine ganze Zeile (Haupttaste, 56 px); die Felder sind Chips und erst bei „Ein“ wählbar. Wie
 * viele Felder gewählt sind, steht nie nur in der Farbe: gewählte Chips tragen das Häkchen (ChipButton). Der Handy-Hinweis sperrt nichts.
 */
import type { CSSProperties, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { InlineNotice } from '../../../components/ui/molecules/InlineNotice';
import { ChipButton } from '../../../components/ui/atoms/ChipButton';
import { ToggleSwitch } from '../../../components/ui/atoms/ToggleSwitch';
import { Input } from '../../../components/ui/Input';

export const GERAETENAME_MAX = 60;

export interface GeraetSchalterProps {
  an: boolean;
  /** Felder des Turniers (1…n). */
  felder: readonly number[];
  gewaehlt: readonly number[];
  name: string;
  onName: (name: string) => void;
  onNameVerlassen: () => void;
  onSchalter: (an: boolean) => void;
  onFeld: (feld: number) => void;
  /** Läuft gerade eine Anfrage: nichts antippbar. */
  beschaeftigt: boolean;
  /** Gerätename eintragen (Schalter in der Einrichtung zeigt ihn nicht doppelt). */
  mitName?: boolean;
  handy: boolean;
  fehler: string | null;
}

const gruppeStil: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.md };
const chipsStil: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: cssVars.spacing.sm };
const hinweisStil: CSSProperties = { margin: 0, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm, lineHeight: cssVars.lineHeights.bodySm };
const schalterStil = (an: boolean): CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: cssVars.spacing.md, width: '100%', minHeight: cssVars.touchTargets.comfortable, padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
  border: `${an ? cssVars.borderWidth.medium : cssVars.borderWidth.thin} solid ${an ? cssVars.colors.primary : cssVars.colors.borderControl}`,
  borderRadius: cssVars.borderRadius.lg, background: cssVars.colors.surface, color: cssVars.colors.textPrimary, cursor: 'pointer', boxSizing: 'border-box',
});
const textStil: CSSProperties = { flex: '1 1 12rem', minWidth: 0, fontWeight: cssVars.fontWeights.semibold, fontSize: cssVars.fontSizes.md, lineHeight: cssVars.lineHeights.bodyMd };
const zustandStil: CSSProperties = { marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: cssVars.spacing.sm, flex: 'none', fontWeight: cssVars.fontWeights.bold, fontSize: cssVars.fontSizes.sm };

export function GeraetSchalter({ an, felder, gewaehlt, name, onName, onNameVerlassen, onSchalter, onFeld, beschaeftigt, mitName = true, handy, fehler }: GeraetSchalterProps): ReactElement {
  const { t } = useTranslation('hallenton');
  return (
    <div style={gruppeStil} data-testid="geraet-schalter">
      {handy ? <InlineNotice tone="warn" data-testid="geraet-handy-hinweis">{t('geraet.handyHinweis')}</InlineNotice> : null}
      {mitName ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: cssVars.spacing.xs }}>
          <Input label={t('geraet.geraeteName')} value={name} onChange={onName} onBlur={onNameVerlassen} maxLength={GERAETENAME_MAX} disabled={beschaeftigt} data-testid="geraet-name" />
          <span style={hinweisStil}>{t('geraet.geraeteNameHinweis')}</span>
        </div>
      ) : null}
      <div role="group" aria-label={t('geraet.schalter')} style={gruppeStil}>
        {/* Die ganze Zeile ist antippbar; der Schalter darin ist die einzige Taste für Tastatur und Hilfstechnik */}
        <div
          style={schalterStil(an)}
          onClick={(e) => { if (!beschaeftigt && !(e.target as HTMLElement).closest('button')) { onSchalter(!an); } }}
          data-testid="geraet-schalter-zeile"
        >
          <span style={textStil}>{t('geraet.schalter')}</span>
          <span style={zustandStil}>
            <span>{an ? t('geraet.schalterEin') : t('geraet.schalterAus')}</span>
            <ToggleSwitch checked={an} onChange={onSchalter} disabled={beschaeftigt} label={t('geraet.schalter')} data-testid="geraet-schalter-taste" />
          </span>
        </div>
        <div style={chipsStil} role="group" aria-label={t('geraet.feldWaehlen')} data-testid="geraet-felder">
          {felder.map((feld) => (
            <ChipButton key={feld} selected={gewaehlt.includes(feld)} disabled={!an || beschaeftigt} onClick={() => onFeld(feld)} data-testid={`geraet-feld-${feld}`}>
              {t('feld.titel', { feld })}
            </ChipButton>
          ))}
        </div>
        {an && gewaehlt.length === 0 ? <p style={hinweisStil} data-testid="geraet-feld-hinweis">{t('geraet.feldWaehlenHinweis')}</p> : null}
      </div>
      {fehler === null ? null : <InlineNotice tone="error" data-testid="geraet-fehler">{fehler}</InlineNotice>}
    </div>
  );
}
