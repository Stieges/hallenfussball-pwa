/**
 * Warnhinweis an einer Folie, deren Feld oder Gruppe das Turnier nicht hat (B-22b, @ME-061).
 * Verschwindet, sobald die Folie angepasst ist (Feld oder Gruppe vorhanden).
 */

import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { slideReferenceProblem } from '../../../core/services/monitorConfigTransferChecks';
import type { SlotTargets } from '../../../core/services/monitorConfigTransferChecks';

const warningStyle: CSSProperties = {
  margin: `${cssVars.spacing.xs} 0 0`,
  padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
  borderRadius: cssVars.borderRadius.sm,
  background: cssVars.colors.warningSubtle,
  color: cssVars.colors.textPrimary,
  fontSize: cssVars.fontSizes.xs,
};

export interface SlideReferenceWarningProps {
  slide: { type: string; config: { fieldId?: string; groupId?: string } };
  targets: SlotTargets;
}

export function SlideReferenceWarning({ slide, targets }: SlideReferenceWarningProps) {
  const { t } = useTranslation('tournament');
  const problem = slideReferenceProblem(slide, targets);
  if (!problem) {return null;}

  return (
    <p role="status" data-testid="slide-reference-warning" style={warningStyle}>
      {problem === 'field' ? t('monitorEditor.slides.referenceField') : t('monitorEditor.slides.referenceGroup')}
    </p>
  );
}
