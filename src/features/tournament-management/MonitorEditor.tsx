/**
 * MonitorEditor - Detaillierte Monitor-Konfiguration
 *
 * MON-KONF-01: Ermöglicht die Konfiguration einer Monitor-Diashow
 *
 * Features:
 * - Monitor-Einstellungen bearbeiten
 * - Slides hinzufügen, entfernen, umordnen
 * - Slide-Konfiguration (Typ-spezifisch)
 * - Live-Vorschau der Slide-Reihenfolge
 *
 * @see MONITOR-KONFIGURATOR-UMSETZUNGSPLAN-v2.md P1-05
 */

import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { dialogWidths } from '../../design-tokens';
import type { Tournament, TournamentGroup } from '../../types/tournament';
import type {
  SlideType,
  SlideConfig,
  TransitionType,
  PerformanceMode,
  MonitorTheme,
} from '../../types/monitor';
import { SLIDE_TYPES } from '../../types/monitor';
import { useMonitors, useSponsors } from '../../hooks';
import { DialogSurface } from '../../components/ui/molecules/DialogSurface';
import { SlideConfigEditor } from './components/SlideConfigEditor';
import { SlidePreview } from './components/SlidePreview';
import { SlideReferenceWarning } from './components/SlideReferenceWarning';
import { useSlotFields } from './hooks/useSlotFields';
import { buildEditorGroups, getSlideDescription } from './components/monitor-editor/monitorEditorHelpers';
import { MonitorSettingsSection } from './components/monitor-editor/MonitorSettingsSection';
import {
  addSlideButtonStyle,
  closeButtonStyle,
  contentStyle,
  editorStyle,
  errorStyle,
  headerStyle,
  iconButtonStyle,
  inputGroupStyle,
  inputStyle,
  labelStyle,
  loadingOverlayStyle,
  sectionStyle,
  sectionTitleStyle,
  selectStyle,
  slideActionsStyle,
  slideConfigStyle,
  slideDescStyle,
  slideIconStyle,
  slideInfoStyle,
  slideItemStyle,
  slidePreviewWrapStyle,
  slideTypeButtonStyle,
  slideTypeIconStyle,
  slideTypeLabelStyle,
  slideTypeQrHintStyle,
  slideTypeSelectorStyle,
  slideTypeStyle,
  slidesListStyle,
  spinnerStyle,
  titleStyle,
} from './components/monitor-editor/monitorEditorStyles';

// =============================================================================
// TYPES
// =============================================================================

interface MonitorEditorProps {
  tournament: Tournament;
  monitorId: string;
  onTournamentUpdate: (tournament: Tournament) => Promise<void>;
  onClose: () => void;
}

interface SlideTypeOption {
  type: SlideType;
  label: string;
  icon: string;
  phase: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

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

// =============================================================================
// COMPONENT
// =============================================================================

export function MonitorEditor({
  tournament,
  monitorId,
  onTournamentUpdate,
  onClose,
}: MonitorEditorProps) {
  const { t } = useTranslation('tournament');

  // Hooks
  const {
    getMonitorById,
    updateMonitor,
    addSlide,
    updateSlide,
    removeSlide,
    reorderSlides,
  } = useMonitors(tournament, onTournamentUpdate);

  const { sponsors } = useSponsors(tournament, onTournamentUpdate);
  // Felder wie die Übernahme-Prüfung; slotTargets für den Warnhinweis an Folien (K4, @ME-061)
  const { fields, getFieldDisplayName, slotTargets } = useSlotFields(tournament, onTournamentUpdate);

  // Get monitor
  const monitor = getMonitorById(monitorId);

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingSlideId, setEditingSlideId] = useState<string | null>(null);
  const [isAddingSlide, setIsAddingSlide] = useState(false);

  // Esc, Fokusfalle und Fokus-Rückgabe liefert DialogSurface (useFocusTrap).

  // Unique ID for aria-labelledby
  const titleId = `monitor-editor-title-${monitorId}`;

  // Get groups from tournament - generate if not explicit
  const groups: TournamentGroup[] = useMemo(() => buildEditorGroups(tournament, t), [tournament, t]);

  // Ohne öffentliches Turnier mit Share-Code entfällt die Zuschauer-QR-Folie im Monitor (@ZM-071, F-04)
  const zuschauerQrMoeglich = tournament.isPublic === true && Boolean(tournament.shareCode);

  // Angebotene Folien-Typen: nur was der Monitor darstellt (@OB-002)
  const availableSlideTypes: SlideTypeOption[] = useMemo(() => {
    return SLIDE_TYPES
      .filter(s => MONITOR_SLIDE_TYPES_OFFERED.includes(s.type))
      .map(s => ({
        type: s.type,
        label: s.label,
        icon: s.icon,
        phase: s.phase,
      }));
  }, []);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handleUpdateSettings = useCallback(async (updates: {
    name?: string;
    defaultSlideDuration?: number;
    transition?: TransitionType;
    transitionDuration?: number;
    performanceMode?: PerformanceMode;
    theme?: MonitorTheme;
    overscanPercent?: number;
  }) => {
    if (!monitor) {return;}

    setIsLoading(true);
    setError(null);

    try {
      await updateMonitor(monitorId, updates);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('monitorEditor.errors.saveFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [monitor, monitorId, updateMonitor, t]);

  const handleAddSlide = useCallback(async (type: SlideType) => {
    setIsLoading(true);
    setError(null);

    try {
      const newSlide = await addSlide(monitorId, type, type === 'live' && fields[0] ? { fieldId: fields[0].id } : undefined); // @ME-066
      if (newSlide) {
        setEditingSlideId(newSlide.id);
      }
      setIsAddingSlide(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('monitorEditor.errors.addFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [monitorId, addSlide, fields, t]);

  const handleUpdateSlide = useCallback(async (
    slideId: string,
    updates: { config?: Partial<SlideConfig>; duration?: number | null }
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      await updateSlide(monitorId, slideId, updates);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('monitorEditor.errors.updateFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [monitorId, updateSlide, t]);

  const handleRemoveSlide = useCallback(async (slideId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      await removeSlide(monitorId, slideId);
      if (editingSlideId === slideId) {
        setEditingSlideId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('monitorEditor.errors.removeFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [monitorId, removeSlide, editingSlideId, t]);

  const handleMoveSlide = useCallback(async (slideId: string, direction: 'up' | 'down') => {
    if (!monitor) {return;}

    const slideIds = monitor.slides.map(s => s.id);
    const currentIndex = slideIds.indexOf(slideId);

    if (currentIndex === -1) {return;}
    if (direction === 'up' && currentIndex === 0) {return;}
    if (direction === 'down' && currentIndex === slideIds.length - 1) {return;}

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const newSlideIds = [...slideIds];
    [newSlideIds[currentIndex], newSlideIds[newIndex]] = [newSlideIds[newIndex], newSlideIds[currentIndex]];

    setIsLoading(true);
    try {
      await reorderSlides(monitorId, newSlideIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('monitorEditor.errors.reorderFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [monitor, monitorId, reorderSlides, t]);

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  const getSlideTypeMeta = (type: SlideType) => {
    return SLIDE_TYPES.find(s => s.type === type);
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  if (!monitor) {
    return (
      <DialogSurface isOpen onClose={onClose} maxWidth={dialogWidths.lg} ariaLabel={t('monitorEditor.notFound')}>
        <div style={editorStyle}>
          <div style={headerStyle}>
            <h2 style={titleStyle}>{t('monitorEditor.notFound')}</h2>
            <button style={closeButtonStyle} onClick={onClose} aria-label={t('monitorEditor.close')}>✕</button>
          </div>
          <div style={contentStyle}>
            <p>{t('monitorEditor.notFoundMessage', { id: monitorId })}</p>
          </div>
        </div>
      </DialogSurface>
    );
  }

  return (
    <DialogSurface isOpen onClose={onClose} maxWidth={dialogWidths.lg} labelledBy={titleId}>
      <div style={editorStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <h2 id={titleId} style={titleStyle}>{monitor.name}</h2>
          <button style={closeButtonStyle} onClick={onClose} aria-label={t('monitorEditor.close')}>✕</button>
        </div>

        {/* Content */}
        <div style={contentStyle}>
          {/* Loading Overlay */}
          {isLoading && (
            <div style={loadingOverlayStyle} aria-label={t('monitorEditor.loading')}>
              <div style={spinnerStyle} />
            </div>
          )}

          {/* Error */}
          {error && <div style={errorStyle}>{error}</div>}

          <MonitorSettingsSection monitor={monitor} onUpdateSettings={handleUpdateSettings} />

          {/* Slides Section */}
          <div style={sectionStyle}>
            <h3 style={sectionTitleStyle}>{t('monitorEditor.slides.title', { count: monitor.slides.length })}</h3>

            <div style={slidesListStyle}>
              {monitor.slides.map((slide, index) => {
                const meta = getSlideTypeMeta(slide.type);
                const isEditing = editingSlideId === slide.id;

                return (
                  <div key={slide.id}>
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
                          onClick={() => void handleMoveSlide(slide.id, 'up')}
                          disabled={index === 0}
                          title={t('monitorEditor.slides.moveUp')}
                        >
                          ↑
                        </button>
                        <button
                          style={iconButtonStyle}
                          onClick={() => void handleMoveSlide(slide.id, 'down')}
                          disabled={index === monitor.slides.length - 1}
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
                          onClick={() => void handleRemoveSlide(slide.id)}
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
                        onUpdate={(config, duration) => void handleUpdateSlide(slide.id, { config, duration })}
                        getFieldDisplayName={getFieldDisplayName}
                        styles={{ slideConfigStyle, inputGroupStyle, labelStyle, selectStyle, inputStyle }}
                      />
                    )}
                  </div>
                );
              })}

              {/* Add Slide Button */}
              <button
                style={addSlideButtonStyle}
                onClick={() => setIsAddingSlide(!isAddingSlide)}
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
                      onClick={() => void handleAddSlide(st.type)}
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
        </div>
      </div>
    </DialogSurface>
  );
}

export default MonitorEditor;
