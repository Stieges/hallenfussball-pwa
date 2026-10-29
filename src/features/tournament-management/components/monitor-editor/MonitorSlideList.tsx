/**
 * Folienliste des Monitor-Editors (M1a ausgelagert): Überschrift, Folienzeilen,
 * „Folie hinzufügen“ und Typwahl mit QR-Hinweis.
 */

import { useTranslation } from 'react-i18next';
import type { SlideType, TournamentMonitor } from '../../../../types/monitor';
import { SLIDE_TYPES } from '../../../../types/monitor';
import { MonitorSlideRow } from './MonitorSlideRow';
import type { SlideActions, SlideContext } from './monitorEditorTypes';
import {
  addSlideButtonStyle,
  sectionStyle,
  sectionTitleStyle,
  slideTypeButtonStyle,
  slideTypeIconStyle,
  slideTypeLabelStyle,
  slideTypeQrHintStyle,
  slideTypeSelectorStyle,
  slidesListStyle,
} from './monitorEditorStyles';

interface SlideTypeOption {
  type: SlideType;
  label: string;
  icon: string;
  phase: number;
}

/**
 * Positivliste der Folien-Typen im Editor (@OB-002: Funktion erst anbieten, wenn sie wirkt).
 * Schedule-group und top-scorers haben keinen Renderer im Monitor und bleiben verborgen.
 */
const MONITOR_SLIDE_TYPES_OFFERED: readonly SlideType[] = [
  'live',
  'standings',
  'schedule-field',
  'sponsor',
  'custom-text',
  'qr-code',
  'all-standings',
  'next-matches',
];

// Angebotene Folien-Typen: nur was der Monitor darstellt (@OB-002)
const availableSlideTypes: SlideTypeOption[] = SLIDE_TYPES
  .filter(s => MONITOR_SLIDE_TYPES_OFFERED.includes(s.type))
  .map(s => ({
    type: s.type,
    label: s.label,
    icon: s.icon,
    phase: s.phase,
  }));

interface MonitorSlideListProps {
  monitor: TournamentMonitor;
  editingSlideId: string | null;
  isAddingSlide: boolean;
  slideContext: SlideContext;
  slideActions: SlideActions;
  onAddSlide: (type: SlideType) => void;
  onToggleAddSlide: () => void;
}

export function MonitorSlideList({
  monitor,
  editingSlideId,
  isAddingSlide,
  slideContext,
  slideActions,
  onAddSlide,
  onToggleAddSlide,
}: MonitorSlideListProps) {
  const { tournament } = slideContext;
  const { t } = useTranslation('tournament');

  // Ohne öffentliches Turnier mit Share-Code entfällt die Zuschauer-QR-Folie im Monitor (@ZM-071, F-04)
  const zuschauerQrMoeglich = tournament.isPublic === true && Boolean(tournament.shareCode);

  return (
    <div style={sectionStyle}>
      <h3 style={sectionTitleStyle}>{t('monitorEditor.slides.title', { count: monitor.slides.length })}</h3>

      <div style={slidesListStyle}>
        {monitor.slides.map((slide, index) => {
          const isEditing = editingSlideId === slide.id;

          return (
            <MonitorSlideRow
              key={slide.id}
              slide={slide}
              index={index}
              slideCount={monitor.slides.length}
              isEditing={isEditing}
              slideContext={slideContext}
              slideActions={slideActions}
            />
          );
        })}

        {/* Add Slide Button */}
        <button
          style={addSlideButtonStyle}
          onClick={() => onToggleAddSlide()}
        >
          <span>+</span>
          <span>{t('monitorEditor.slides.addSlide')}</span>
        </button>

        {/* Slide Type Selector */}
        {isAddingSlide && (
          <div style={slideTypeSelectorStyle}>
            {availableSlideTypes.map(st => (
              <button
                key={st.type}
                style={slideTypeButtonStyle}
                onClick={() => onAddSlide(st.type)}
              >
                <div style={slideTypeIconStyle}>{st.icon}</div>
                <div style={slideTypeLabelStyle}>{st.label}</div>
                {st.type === 'qr-code' && !zuschauerQrMoeglich && (
                  <div style={slideTypeQrHintStyle}>
                    {t('monitorEditor.slides.qrHidden')}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
