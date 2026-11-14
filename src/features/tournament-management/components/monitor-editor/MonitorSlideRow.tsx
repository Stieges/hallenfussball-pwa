/**
 * Eine Folienzeile des Monitor-Editors (M1a ausgelagert): Symbol, Typ, Beschreibung,
 * Tasten ↑ ↓ ✏️ 🗑️, Warnhinweis und beim Bearbeiten Vorschau sowie Folien-Konfiguration.
 */

import { useTranslation } from 'react-i18next';
import type { MonitorSlide, SlideType } from '../../../../types/monitor';
import { SLIDE_TYPES } from '../../../../types/monitor';
import { SlideConfigEditor } from '../SlideConfigEditor';
import { SlidePreview } from '../SlidePreview';
import { SlideReferenceWarning } from '../SlideReferenceWarning';
import { getSlideDescription, slideSetupProblem } from './monitorEditorHelpers';
import { slideTypeLabel } from './slideTypeLabels';
import type { SlideActions, SlideContext } from './monitorEditorTypes';
import {
  iconButtonStyle,
  inputGroupStyle,
  inputStyle,
  labelStyle,
  selectStyle,
  slideActionsStyle,
  slideConfigStyle,
  slideDescStyle,
  slideIconStyle,
  slideInfoStyle,
  slideItemStyle,
  slideProblemStyle,
  slidePreviewWrapStyle,
  slideTypeStyle,
} from './monitorEditorStyles';

function getSlideTypeMeta(type: SlideType) {
  return SLIDE_TYPES.find(s => s.type === type);
}

interface MonitorSlideRowProps {
  slide: MonitorSlide;
  index: number;
  slideCount: number;
  isEditing: boolean;
  slideContext: SlideContext;
  slideActions: SlideActions;
}

export function MonitorSlideRow({ slide, index, slideCount, isEditing, slideContext, slideActions }: MonitorSlideRowProps) {
  const { tournament, fields, groups, sponsors, slotTargets, getFieldDisplayName, showErrors } = slideContext;
  const { onMoveSlide, onRemoveSlide, onUpdateSlide, onToggleEditSlide } = slideActions;
  const { t } = useTranslation('tournament');
  const meta = getSlideTypeMeta(slide.type);
  const label = slideTypeLabel(t, slide.type);
  const problem = slideSetupProblem(slide, sponsors);

  return (
    <div data-testid={`monitor-slide-row-${slide.id}`}>
      <div style={slideItemStyle(isEditing)}>
        {/* Icon: rein dekorativ */}
        <div style={slideIconStyle} aria-hidden="true">{meta?.icon ?? '📄'}</div>

        {/* Info; fehlt etwas, steht es in Warnfarbe und ungekürzt da (@ME-076) */}
        <div style={slideInfoStyle}>
          <div style={slideTypeStyle}>{label}</div>
          <div
            style={problem ? slideProblemStyle : slideDescStyle}
            data-testid={problem ? 'monitor-slide-problem' : 'monitor-slide-desc'}
          >
            {getSlideDescription(slide, { groups, sponsors, getFieldDisplayName, t })}
          </div>
        </div>

        {/* Actions */}
        <div style={slideActionsStyle}>
          <button
            style={iconButtonStyle}
            onClick={() => onMoveSlide(slide.id, 'up')}
            disabled={index === 0}
            title={t('monitorEditor.slides.moveUp')}
            aria-label={t('monitorEditor.slides.moveUpAria', { slide: label })}
          >
            ↑
          </button>
          <button
            style={iconButtonStyle}
            onClick={() => onMoveSlide(slide.id, 'down')}
            disabled={index === slideCount - 1}
            title={t('monitorEditor.slides.moveDown')}
            aria-label={t('monitorEditor.slides.moveDownAria', { slide: label })}
          >
            ↓
          </button>
          <button
            style={iconButtonStyle}
            onClick={() => onToggleEditSlide(slide.id)}
            title={t('monitorEditor.slides.edit')}
            aria-label={t('monitorEditor.slides.editAria', { slide: label })}
            aria-expanded={isEditing}
            data-testid={`monitor-slide-edit-${slide.id}`}
          >
            <span aria-hidden="true">✏️</span>
          </button>
          <button
            style={iconButtonStyle}
            onClick={() => onRemoveSlide(slide.id)}
            title={t('monitorEditor.slides.remove')}
            aria-label={t('monitorEditor.slides.removeAria', { slide: label })}
          >
            <span aria-hidden="true">🗑️</span>
          </button>
        </div>
      </div>
      <SlideReferenceWarning slide={slide} targets={slotTargets} />

      {/* Slide Preview + Config (wenn bearbeitet) */}
      {isEditing && (
        <div style={slidePreviewWrapStyle}>
          <SlidePreview slide={slide} tournament={tournament} scale={0.15} />
        </div>
      )}
      {isEditing && (
        <SlideConfigEditor
          slide={slide}
          fields={fields}
          groups={groups}
          sponsors={sponsors}
          onUpdate={(config, duration) => onUpdateSlide(slide.id, { config, duration })}
          getFieldDisplayName={getFieldDisplayName}
          showErrors={showErrors}
          styles={{ slideConfigStyle, inputGroupStyle, labelStyle, selectStyle, inputStyle }}
        />
      )}
    </div>
  );
}
