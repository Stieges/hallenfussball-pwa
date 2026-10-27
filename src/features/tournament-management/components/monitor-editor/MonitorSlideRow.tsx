/**
 * Eine Folienzeile des Monitor-Editors (M1a ausgelagert): Symbol, Typ, Beschreibung,
 * Tasten ↑ ↓ ✏️ 🗑️, Warnhinweis und beim Bearbeiten Vorschau sowie Folien-Konfiguration.
 */

import { useTranslation } from 'react-i18next';
import type { Tournament, TournamentField, TournamentGroup } from '../../../../types/tournament';
import type { MonitorSlide, SlideConfig, SlideType } from '../../../../types/monitor';
import { SLIDE_TYPES } from '../../../../types/monitor';
import type { SlotTargets } from '../../../../core/services/monitorConfigTransferChecks';
import { SlideConfigEditor } from '../SlideConfigEditor';
import { SlidePreview } from '../SlidePreview';
import { SlideReferenceWarning } from '../SlideReferenceWarning';
import { getSlideDescription } from './monitorEditorHelpers';
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
  tournament: Tournament;
  fields: TournamentField[];
  groups: TournamentGroup[];
  sponsors: { id: string; name: string }[];
  slotTargets: SlotTargets;
  getFieldDisplayName: (id: string) => string;
  onMoveSlide: (slideId: string, direction: 'up' | 'down') => Promise<void>;
  onRemoveSlide: (slideId: string) => Promise<void>;
  onUpdateSlide: (slideId: string, updates: { config?: Partial<SlideConfig>; duration?: number | null }) => Promise<void>;
  setEditingSlideId: (id: string | null) => void;
}

export function MonitorSlideRow({
  slide,
  index,
  slideCount,
  isEditing,
  tournament,
  fields,
  groups,
  sponsors,
  slotTargets,
  getFieldDisplayName,
  onMoveSlide,
  onRemoveSlide,
  onUpdateSlide,
  setEditingSlideId,
}: MonitorSlideRowProps) {
  const { t } = useTranslation('tournament');
  const meta = getSlideTypeMeta(slide.type);

  return (
    <div>
      <div style={slideItemStyle(isEditing)}>
        {/* Icon */}
        <div style={slideIconStyle}>{meta?.icon ?? '📄'}</div>

        {/* Info */}
        <div style={slideInfoStyle}>
          <div style={slideTypeStyle}>{meta?.label ?? slide.type}</div>
          <div style={slideDescStyle}>{getSlideDescription(slide, { groups, sponsors, getFieldDisplayName, t })}</div>
        </div>

        {/* Actions */}
        <div style={slideActionsStyle}>
          <button
            style={iconButtonStyle}
            onClick={() => void onMoveSlide(slide.id, 'up')}
            disabled={index === 0}
            title={t('monitorEditor.slides.moveUp')}
          >
            ↑
          </button>
          <button
            style={iconButtonStyle}
            onClick={() => void onMoveSlide(slide.id, 'down')}
            disabled={index === slideCount - 1}
            title={t('monitorEditor.slides.moveDown')}
          >
            ↓
          </button>
          <button
            style={iconButtonStyle}
            onClick={() => setEditingSlideId(isEditing ? null : slide.id)}
            title={t('monitorEditor.slides.edit')}
          >
            ✏️
          </button>
          <button
            style={iconButtonStyle}
            onClick={() => void onRemoveSlide(slide.id)}
            title={t('monitorEditor.slides.remove')}
          >
            🗑️
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
          onUpdate={(config, duration) => void onUpdateSlide(slide.id, { config, duration })}
          getFieldDisplayName={getFieldDisplayName}
          styles={{ slideConfigStyle, inputGroupStyle, labelStyle, selectStyle, inputStyle }}
        />
      )}
    </div>
  );
}
