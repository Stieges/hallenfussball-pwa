/**
 * Rückfrage beim Speichern, wenn Folien noch nicht eingerichtet sind (@ME-076): ein eigener Dialog mit der Liste der
 * betroffenen Folien. „Zurück zum Editor“ ist die Abbruchtaste (Esc, Tippen daneben), „Trotzdem speichern“ speichert.
 */

import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../../design-tokens';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import type { MonitorSlide } from '../../../../types/monitor';
import type { SlideSetupProblem } from './monitorEditorHelpers';
import { slideTypeLabel } from './slideTypeLabels';

export interface UnreadySlide {
  slide: MonitorSlide;
  problem: SlideSetupProblem;
}

interface UnreadySlidesDialogProps {
  isOpen: boolean;
  slides: readonly UnreadySlide[];
  onBack: () => void;
  onSaveAnyway: () => void;
}

const listStyle: CSSProperties = {
  margin: `${cssVars.spacing.sm} 0 0`,
  paddingLeft: cssVars.spacing.lg,
  textAlign: 'left',
  color: cssVars.colors.warning,
  fontWeight: cssVars.fontWeights.semibold,
};

export function UnreadySlidesDialog({ isOpen, slides, onBack, onSaveAnyway }: UnreadySlidesDialogProps) {
  const { t } = useTranslation('tournament');
  return (
    <ConfirmDialog
      isOpen={isOpen}
      variant="warning"
      title={t('monitorEditor.unready.title')}
      message={
        <div data-testid="monitor-unready-dialog">
          <p style={{ margin: 0 }}>{t('monitorEditor.unready.message', { count: slides.length })}</p>
          <ul style={listStyle} data-testid="monitor-unready-list">
            {slides.map(({ slide, problem }) => (
              <li key={slide.id}>
                {t('monitorEditor.unready.item', {
                  slide: slideTypeLabel(t, slide.type),
                  problem: t(`monitorEditor.setupProblem.${problem}`),
                })}
              </li>
            ))}
          </ul>
        </div>
      }
      confirmText={t('monitorEditor.unready.saveAnyway')}
      cancelText={t('monitorEditor.unready.backToEditor')}
      onConfirm={onSaveAnyway}
      onCancel={onBack}
    />
  );
}
