/**
 * LautstaerkeRegler – „Lautstärke dieses Geräts“ (H4-10, @HT-023): je ein Regler für Abpfiff-Ton, Halbzeit-Ton und Torhymne, neben jedem „Anhören“
 * (spielt seinen Ton einmal, auch den Halbzeit-Ton), dazu „Stumm“. Gilt nur für dieses Gerät, nicht für das Turnier (lokal, bleibt nach dem
 * Neuladen). Nach dem Turnierende lesbar, nicht änderbar (`gesperrt`). Nur Darstellung mit Props; das Anhören mit Rückfrage steht in `useAnhoeren`.
 */
import type { CSSProperties, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import { Icons } from '../../../components/ui/Icons';
import { ToggleSwitch } from '../../../components/ui/atoms/ToggleSwitch';
import type { ReglerArt } from '../runtime/tonEinstellungen';

const REGLER: readonly ReglerArt[] = ['abpfiff', 'halbzeit', 'tor'];

export interface LautstaerkeReglerProps {
  lautstaerke: Readonly<Record<ReglerArt, number>>;
  stumm: boolean;
  gesperrt: boolean;
  onLautstaerke: (art: ReglerArt, prozent: number) => void;
  onStumm: (stumm: boolean) => void;
  onAnhoeren: (art: ReglerArt) => void;
  /** Was das letzte „Anhören“ nicht gespielt hat (ruhige Zeile unter dem Regler), sonst `null`. */
  hinweis: { art: ReglerArt; text: string } | null;
}

const gruppeStil: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.md };
const titelStil: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.titleMd, lineHeight: cssVars.lineHeights.title, fontWeight: cssVars.fontWeights.semibold };
const textStil: CSSProperties = { margin: 0, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm, lineHeight: cssVars.lineHeights.bodySm };
const reglerStil: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 5ch auto', gap: `${cssVars.spacing.sm} ${cssVars.spacing.md}`, alignItems: 'center' };
const beschriftungStil: CSSProperties = { gridColumn: '1 / -1', fontWeight: cssVars.fontWeights.semibold, fontSize: cssVars.fontSizes.md };
const schiebeStil: CSSProperties = { fontSize: cssVars.fontSizes.bodyLg, width: '100%', minHeight: cssVars.touchTargets.minimum, margin: 0, accentColor: cssVars.colors.primary };
const wertStil: CSSProperties = { fontWeight: cssVars.fontWeights.bold, fontVariantNumeric: 'tabular-nums', textAlign: 'right' };
const stummStil: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: cssVars.spacing.md, flexWrap: 'wrap' };

export function LautstaerkeRegler({ lautstaerke, stumm, gesperrt, onLautstaerke, onStumm, onAnhoeren, hinweis }: LautstaerkeReglerProps): ReactElement {
  const { t } = useTranslation('hallenton');
  return (
    <div style={gruppeStil} data-testid="geraet-lautstaerke">
      <h3 style={titelStil}>{t('regler.titel')}</h3>
      <p style={textStil}>{gesperrt ? t('regler.gesperrt') : t('regler.text')}</p>
      {REGLER.map((art) => (
        <div key={art} style={reglerStil} data-testid={`regler-${art}`}>
          <span style={beschriftungStil} id={`lv-${art}-l`}>{t(`regler.${art}`)}</span>
          <input
            type="range" min={0} max={100} step={1} value={lautstaerke[art]} style={schiebeStil} disabled={gesperrt}
            aria-labelledby={`lv-${art}-l`} aria-valuetext={t('regler.prozent', { wert: lautstaerke[art] })}
            onChange={(e) => onLautstaerke(art, Number(e.target.value))} data-testid={`regler-${art}-schieber`}
          />
          <output style={wertStil} data-testid={`regler-${art}-wert`}>{t('regler.prozent', { wert: lautstaerke[art] })}</output>
          <Button
            variant="secondary" icon={<Icons.Play size={iconSizeValues.sm} />} disabled={gesperrt} onClick={() => onAnhoeren(art)}
            aria-label={`${t('regler.anhoeren')}: ${t(`regler.${art}`)}`} data-testid={`regler-${art}-anhoeren`}
          >
            {t('regler.anhoeren')}
          </Button>
          {hinweis?.art === art ? <p style={{ ...textStil, gridColumn: '1 / -1' }} role="status" data-testid={`regler-${art}-hinweis`}>{hinweis.text}</p> : null}
        </div>
      ))}
      <div style={stummStil}>
        <div style={{ minWidth: 0, flex: '1 1 12rem' }}>
          <span style={{ fontWeight: cssVars.fontWeights.semibold, fontSize: cssVars.fontSizes.md }}>{t('regler.stumm')}</span>
          <p style={textStil}>{t('regler.stummText')}</p>
        </div>
        <ToggleSwitch checked={stumm} onChange={onStumm} disabled={gesperrt} label={t('regler.stumm')} data-testid="regler-stumm" />
      </div>
    </div>
  );
}
