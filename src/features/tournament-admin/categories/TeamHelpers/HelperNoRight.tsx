/**
 * HelperNoRight – Zustand „Nur die Turnierleitung kann Helfer verwalten“ (A-18a, Mockup M4 `r10`, @HE-062): wer das Recht
 * „Helfer verwalten“ nicht hat (Helfer-Gerät, Co-Admin ohne Recht), sieht statt der Tasten den Grund. Die Seite fragt in dem
 * Fall den Server nicht ab. Entspricht der Endzustand-Karte der Helfer-Seite (A-17b, `EndStateCard`); sobald dieser Baustein
 * auf main liegt, ersetzt er diese kleine Karte.
 */
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { TafelIcons } from '../../../../components/ui/IconsTafel';
import { cssVars, iconSizeValues } from '../../../../design-tokens';

const card: CSSProperties = {
  display: 'grid',
  justifyItems: 'center',
  textAlign: 'center',
  gap: cssVars.spacing.sm,
  padding: `${cssVars.spacing.lg} ${cssVars.spacing.md}`,
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
  borderRadius: cssVars.borderRadius.md,
  background: cssVars.colors.surface,
  color: cssVars.colors.textPrimary,
};
const circle: CSSProperties = {
  width: cssVars.touchTargets.primary,
  height: cssVars.touchTargets.primary,
  borderRadius: cssVars.borderRadius.full,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`,
  color: cssVars.colors.textSecondary,
  backgroundColor: cssVars.colors.background,
};
const title: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.xl, lineHeight: cssVars.lineHeights.title, fontWeight: cssVars.fontWeights.bold, overflowWrap: 'break-word', maxWidth: '100%' };
const text: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.md, maxWidth: '100%', overflowWrap: 'break-word' };

export const HelperNoRight = () => {
  const { t } = useTranslation('admin');
  return (
    <section style={card} data-testid="no-right" role="status">
      <span style={circle} aria-hidden="true"><TafelIcons.Lock size={iconSizeValues.md} /></span>
      <h2 style={title}>{t('teamHelpers.noRight.title')}</h2>
      <p style={text}>{t('teamHelpers.noRight.text')}</p>
    </section>
  );
};
