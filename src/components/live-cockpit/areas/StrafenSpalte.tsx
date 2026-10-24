/**
 * StrafenSpalte – Kasten „Aktive Zeitstrafen“ über der Liste am Laptop (Plan Cockpit v2 B3; @SL-186, Mockup `haupt-720`, `ohne-strafe-720`).
 *
 * Ohne laufende Strafe eine Zeile „Aktive Zeitstrafen · keine“, sonst je Strafe eine Karte (höchstens zwei je Team, die kürzeste Restzeit zuerst),
 * jede weitere als „+ n weitere“. Die Texte entstehen hier aus dem Modell (`toStrafenModel`); die Karte selbst ist reine Anzeige.
 */
import type { CSSProperties, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { PenaltyCard } from '../../ui/molecules/PenaltyCard';
import type { StrafenModel } from '../model/toStrafenModel';

export interface StrafenSpalteProps { model: StrafenModel }

const kasten: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: cssVars.spacing.sm, padding: cssVars.spacing.md, boxSizing: 'border-box', minWidth: 0,
  background: cssVars.colors.surface, border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`, borderRadius: cssVars.borderRadius.md,
};
const titel: CSSProperties = {
  margin: 0, fontSize: cssVars.fontSizes.labelMd, lineHeight: cssVars.lineHeights.bodySm, fontWeight: cssVars.fontWeights.bold,
  color: cssVars.colors.textSecondary, letterSpacing: cssVars.letterSpacing.wider, textTransform: 'uppercase',
};

export function StrafenSpalte({ model }: StrafenSpalteProps): ReactElement {
  const { t } = useTranslation('cockpit');
  if (model.karten.length === 0) {
    return (
      <div style={{ ...kasten, flexDirection: 'row', alignItems: 'center', gap: cssVars.spacing.sm }} data-testid="strafen-spalte" data-anzahl="0">
        <h3 style={titel}>{t('strafen.titel')}</h3>
        <span style={{ fontSize: cssVars.fontSizes.lg, color: cssVars.colors.textPrimary }} data-testid="strafen-keine">{t('strafen.keine')}</span>
      </div>
    );
  }
  return (
    <div style={kasten} data-testid="strafen-spalte" data-anzahl={model.karten.length}>
      <h3 style={titel}>{t('strafen.titel')}</h3>
      {model.karten.map((k) => (
        <PenaltyCard
          key={k.id} testId={`strafen-karte-${k.id}`} etikett={t('strafen.restzeit')} rest={k.rest} anteil={k.anteil} fill={k.kasten.fill}
          titel={k.nummer === null ? t('strafen.ohneNr', { team: k.teamName }) : t('strafen.mitNr', { team: k.teamName, nummer: k.nummer })}
          unterzeile={k.seit === null ? t('strafen.dauer', { minuten: k.minuten }) : t('strafen.dauerSeit', { minuten: k.minuten, zeit: k.seit })}
        />
      ))}
      {model.weitere > 0 && <div style={{ fontSize: cssVars.fontSizes.md, color: cssVars.colors.textSecondary, fontWeight: cssVars.fontWeights.semibold }} data-testid="strafen-weitere">{t('strafen.weitere', { count: model.weitere })}</div>}
    </div>
  );
}
