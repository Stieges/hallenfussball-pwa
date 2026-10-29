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
import { useMonitors, useSponsors } from '../../hooks';
import { DialogSurface } from '../../components/ui/molecules/DialogSurface';
import { useSlotFields } from './hooks/useSlotFields';
import { buildEditorGroups } from './components/monitor-editor/monitorEditorHelpers';
import { MonitorSettingsSection } from './components/monitor-editor/MonitorSettingsSection';
import { MonitorSlideList } from './components/monitor-editor/MonitorSlideList';
import {
  closeButtonStyle,
  contentStyle,
  editorStyle,
  errorStyle,
  headerStyle,
  loadingOverlayStyle,
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

  const handleToggleEditSlide = useCallback((slideId: string) => {
    setEditingSlideId(editingSlideId === slideId ? null : slideId);
  }, [editingSlideId]);

  const handleToggleAddSlide = useCallback(() => {
    setIsAddingSlide(!isAddingSlide);
  }, [isAddingSlide]);

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

          <MonitorSlideList
            monitor={monitor}
            tournament={tournament}
            editingSlideId={editingSlideId}
            isAddingSlide={isAddingSlide}
            fields={fields}
            groups={groups}
            sponsors={sponsors}
            slotTargets={slotTargets}
            getFieldDisplayName={getFieldDisplayName}
            onAddSlide={handleAddSlide}
            onMoveSlide={handleMoveSlide}
            onRemoveSlide={handleRemoveSlide}
            onUpdateSlide={handleUpdateSlide}
            onToggleEditSlide={handleToggleEditSlide}
            onToggleAddSlide={handleToggleAddSlide}
          />
        </div>
      </div>
    </DialogSurface>
  );
}

export default MonitorEditor;
