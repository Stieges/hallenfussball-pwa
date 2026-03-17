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

import { useState, useCallback, useMemo, useEffect, useRef, CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../design-tokens';
import type { Tournament, TournamentGroup } from '../../types/tournament';
import type {
  MonitorSlide,
  SlideType,
  SlideConfig,
  TransitionType,
  PerformanceMode,
  MonitorTheme,
} from '../../types/monitor';
import { SLIDE_TYPES } from '../../types/monitor';
import { useMonitors, useSponsors, useFields } from '../../hooks';
import { SlideConfigEditor } from './components/SlideConfigEditor';
import { SlidePreview } from './components/SlidePreview';

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

const TRANSITION_OPTIONS: { value: TransitionType; labelKey: string }[] = [
  { value: 'fade', labelKey: 'monitorEditor.settings.transitions.fade' },
  { value: 'slide', labelKey: 'monitorEditor.settings.transitions.slide' },
  { value: 'none', labelKey: 'monitorEditor.settings.transitions.none' },
];

const PERFORMANCE_OPTIONS: { value: PerformanceMode; labelKey: string; descriptionKey: string }[] = [
  { value: 'auto', labelKey: 'monitorEditor.settings.performance.auto', descriptionKey: 'monitorEditor.settings.performance.autoDesc' },
  { value: 'high', labelKey: 'monitorEditor.settings.performance.high', descriptionKey: 'monitorEditor.settings.performance.highDesc' },
  { value: 'low', labelKey: 'monitorEditor.settings.performance.low', descriptionKey: 'monitorEditor.settings.performance.lowDesc' },
];

const THEME_OPTIONS: { value: MonitorTheme; labelKey: string; descriptionKey: string }[] = [
  { value: 'dark', labelKey: 'monitorEditor.settings.themes.dark', descriptionKey: 'monitorEditor.settings.themes.darkDesc' },
  { value: 'light', labelKey: 'monitorEditor.settings.themes.light', descriptionKey: 'monitorEditor.settings.themes.lightDesc' },
  { value: 'auto', labelKey: 'monitorEditor.settings.themes.auto', descriptionKey: 'monitorEditor.settings.themes.autoDesc' },
];

const DURATION_PRESETS = [5, 10, 15, 20, 30, 45, 60];

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
  const { fields, getFieldDisplayName } = useFields(tournament, onTournamentUpdate);

  // Get monitor
  const monitor = getMonitorById(monitorId);

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingSlideId, setEditingSlideId] = useState<string | null>(null);
  const [isAddingSlide, setIsAddingSlide] = useState(false);

  // Focus management: Remember what was focused before opening
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Store the currently focused element when modal opens
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Return focus when modal closes (cleanup)
    return () => {
      previousFocusRef.current?.focus();
    };
  }, []);

  // Handle escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Unique ID for aria-labelledby
  const titleId = `monitor-editor-title-${monitorId}`;

  // Get groups from tournament - generate if not explicit
  // For roundRobin tournaments, there's only one group (all teams play each other)
  const groups: TournamentGroup[] = useMemo(() => {
    // Round-robin mode = single group tournament (everyone plays everyone)
    if (tournament.groupSystem === 'roundRobin') {
      return [{ id: 'default', customName: t('monitorEditor.allTeams') }];
    }

    // If explicit groups are defined, use them
    if (tournament.groups && tournament.groups.length > 0) {
      return tournament.groups;
    }

    // If numberOfGroups is set, generate synthetic group entries
    const numGroups = tournament.numberOfGroups ?? 1;
    if (numGroups <= 1) {
      // Single group tournament - return one default group
      return [{ id: 'default', customName: t('monitorEditor.allTeams') }];
    }

    // Generate group entries A, B, C, etc.
    return Array.from({ length: numGroups }, (_, i) => ({
      id: String.fromCharCode(65 + i), // A, B, C...
      customName: t('monitorEditor.groupLabel', { letter: String.fromCharCode(65 + i) }),
    }));
  }, [tournament.groups, tournament.numberOfGroups, tournament.groupSystem, t]);

  // Available slide types (Phase 1 only)
  const availableSlideTypes: SlideTypeOption[] = useMemo(() => {
    return SLIDE_TYPES
      .filter(s => s.phase === 1)
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
    overscanPx?: number;
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
      const newSlide = await addSlide(monitorId, type);
      if (newSlide) {
        setEditingSlideId(newSlide.id);
      }
      setIsAddingSlide(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('monitorEditor.errors.addFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [monitorId, addSlide, t]);

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

  const getSlideDescription = (slide: MonitorSlide): string => {
    const { type, config } = slide;

    switch (type) {
      case 'live':
      case 'schedule-field': {
        const fieldName = config.fieldId ? getFieldDisplayName(config.fieldId) : t('monitorEditor.notConfigured');
        return fieldName;
      }
      case 'standings':
      case 'schedule-group': {
        const group = groups.find(g => g.id === config.groupId);
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Empty customName should use fallback
        return group?.customName || t('monitorEditor.groupLabel', { letter: config.groupId }) || t('monitorEditor.notConfigured');
      }
      case 'sponsor': {
        const sponsor = sponsors.find(s => s.id === config.sponsorId);
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Empty name should use fallback
        return sponsor?.name || t('monitorEditor.notConfigured');
      }
      case 'custom-text':
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Empty headline should use fallback
        return config.headline || t('monitorEditor.customText');
      default:
        return '';
    }
  };

  // ==========================================================================
  // STYLES
  // ==========================================================================

  const overlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: cssVars.spacing.lg,
  };

  const editorStyle: CSSProperties = {
    width: '100%',
    maxWidth: '800px',
    maxHeight: '90vh',
    background: cssVars.colors.background,
    borderRadius: cssVars.borderRadius.lg,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  const headerStyle: CSSProperties = {
    padding: cssVars.spacing.lg,
    borderBottom: `1px solid ${cssVars.colors.border}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const titleStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xl,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
    margin: 0,
  };

  const closeButtonStyle: CSSProperties = {
    minWidth: '44px',
    minHeight: '44px',
    background: 'transparent',
    border: 'none',
    fontSize: cssVars.fontSizes.xl,
    cursor: 'pointer',
    color: cssVars.colors.textSecondary,
  };

  const contentStyle: CSSProperties = {
    flex: 1,
    overflow: 'auto',
    padding: cssVars.spacing.lg,
    position: 'relative',
  };

  const loadingOverlayStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    borderRadius: cssVars.borderRadius.md,
  };

  const spinnerStyle: CSSProperties = {
    width: 40,
    height: 40,
    border: `3px solid ${cssVars.colors.border}`,
    borderTopColor: cssVars.colors.primary,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  };

  const sectionStyle: CSSProperties = {
    marginBottom: cssVars.spacing.xl,
  };

  const sectionTitleStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
    marginBottom: cssVars.spacing.md,
  };

  const settingsGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: cssVars.spacing.md,
  };

  const inputGroupStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.xs,
  };

  const labelStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
  };

  const inputStyle: CSSProperties = {
    padding: cssVars.spacing.sm,
    borderRadius: cssVars.borderRadius.md,
    border: `1px solid ${cssVars.colors.border}`,
    background: cssVars.colors.surface,
    color: cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.md,
  };

  const selectStyle: CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
  };

  const slidesListStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.sm,
  };

  const slideItemStyle = (isEditing: boolean): CSSProperties => ({
    padding: cssVars.spacing.md,
    background: cssVars.colors.surface,
    borderRadius: cssVars.borderRadius.md,
    border: `1px solid ${isEditing ? cssVars.colors.primary : cssVars.colors.border}`,
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.md,
  });

  const slideIconStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xl,
    width: '40px',
    textAlign: 'center',
  };

  const slideInfoStyle: CSSProperties = {
    flex: 1,
    minWidth: 0,
  };

  const slideTypeStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textPrimary,
  };

  const slideDescStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const slideActionsStyle: CSSProperties = {
    display: 'flex',
    gap: cssVars.spacing.xs,
  };

  const iconButtonStyle: CSSProperties = {
    minWidth: '36px',
    minHeight: '36px',
    padding: cssVars.spacing.xs,
    background: 'transparent',
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.sm,
    cursor: 'pointer',
    fontSize: cssVars.fontSizes.md,
  };

  const addSlideButtonStyle: CSSProperties = {
    width: '100%',
    padding: cssVars.spacing.md,
    background: cssVars.colors.surfaceLight,
    border: `2px dashed ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    cursor: 'pointer',
    fontSize: cssVars.fontSizes.md,
    color: cssVars.colors.textSecondary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: cssVars.spacing.sm,
  };

  const slideTypeSelectorStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: cssVars.spacing.sm,
    marginTop: cssVars.spacing.md,
    padding: cssVars.spacing.md,
    background: cssVars.colors.surface,
    borderRadius: cssVars.borderRadius.md,
    border: `1px solid ${cssVars.colors.border}`,
  };

  const slideTypeButtonStyle: CSSProperties = {
    padding: cssVars.spacing.md,
    background: cssVars.colors.surfaceLight,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    cursor: 'pointer',
    textAlign: 'center',
  };

  const errorStyle: CSSProperties = {
    padding: cssVars.spacing.sm,
    background: `${cssVars.colors.error}22`,
    color: cssVars.colors.error,
    borderRadius: cssVars.borderRadius.sm,
    fontSize: cssVars.fontSizes.sm,
    marginBottom: cssVars.spacing.md,
  };

  const slideConfigStyle: CSSProperties = {
    marginTop: cssVars.spacing.md,
    padding: cssVars.spacing.md,
    background: cssVars.colors.surfaceLight,
    borderRadius: cssVars.borderRadius.md,
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  if (!monitor) {
    return (
      <div
        style={overlayStyle}
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={t('monitorEditor.notFound')}
      >
        <div style={editorStyle} onClick={e => e.stopPropagation()}>
          <div style={headerStyle}>
            <h2 style={titleStyle}>{t('monitorEditor.notFound')}</h2>
            <button style={closeButtonStyle} onClick={onClose} aria-label={t('monitorEditor.close')}>✕</button>
          </div>
          <div style={contentStyle}>
            <p>{t('monitorEditor.notFoundMessage', { id: monitorId })}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={overlayStyle}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div style={editorStyle} onClick={e => e.stopPropagation()}>
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

          {/* Settings Section */}
          <div style={sectionStyle}>
            <h3 style={sectionTitleStyle}>{t('monitorEditor.settings.title')}</h3>
            <div style={settingsGridStyle}>
              {/* Name */}
              <div style={inputGroupStyle}>
                <label style={labelStyle}>{t('monitorEditor.settings.name')}</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={monitor.name}
                  onChange={(e) => void handleUpdateSettings({ name: e.target.value })}
                />
              </div>

              {/* Duration */}
              <div style={inputGroupStyle}>
                <label style={labelStyle}>{t('monitorEditor.settings.slideDuration')}</label>
                <select
                  style={selectStyle}
                  value={monitor.defaultSlideDuration}
                  onChange={(e) => void handleUpdateSettings({ defaultSlideDuration: Number(e.target.value) })}
                >
                  {DURATION_PRESETS.map(d => (
                    <option key={d} value={d}>{d}s</option>
                  ))}
                </select>
              </div>

              {/* Transition */}
              <div style={inputGroupStyle}>
                <label style={labelStyle}>{t('monitorEditor.settings.transition')}</label>
                <select
                  style={selectStyle}
                  value={monitor.transition}
                  onChange={(e) => void handleUpdateSettings({ transition: e.target.value as TransitionType })}
                >
                  {TRANSITION_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{t(opt.labelKey as never)}</option>
                  ))}
                </select>
              </div>

              {/* Performance Mode */}
              <div style={inputGroupStyle}>
                <label style={labelStyle}>{t('monitorEditor.settings.performanceLabel')}</label>
                <select
                  style={selectStyle}
                  value={monitor.performanceMode}
                  onChange={(e) => void handleUpdateSettings({ performanceMode: e.target.value as PerformanceMode })}
                >
                  {PERFORMANCE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{t(opt.labelKey as never)}</option>
                  ))}
                </select>
              </div>

              {/* Theme */}
              <div style={inputGroupStyle}>
                <label style={labelStyle}>{t('monitorEditor.settings.themeLabel')}</label>
                <select
                  style={selectStyle}
                  value={monitor.theme}
                  onChange={(e) => void handleUpdateSettings({ theme: e.target.value as MonitorTheme })}
                >
                  {THEME_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{t(opt.labelKey as never)}</option>
                  ))}
                </select>
              </div>

              {/* Overscan */}
              <div style={inputGroupStyle}>
                <label style={labelStyle}>
                  {t('monitorEditor.settings.overscan', { px: monitor.overscanPx ?? 48 })}
                </label>
                <input
                  type="range"
                  min={0}
                  max={80}
                  step={4}
                  value={monitor.overscanPx ?? 48}
                  onChange={(e) => void handleUpdateSettings({ overscanPx: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: cssVars.colors.primary }}
                />
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: cssVars.fontSizes.xs,
                  color: cssVars.colors.textMuted,
                }}>
                  <span>{t('monitorEditor.settings.noMargin')}</span>
                  <span>80px</span>
                </div>
              </div>
            </div>
          </div>

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
                        <div style={slideDescStyle}>{getSlideDescription(slide)}</div>
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

                    {/* Slide Preview + Config (wenn bearbeitet) */}
                    {isEditing && (
                      <div style={{ padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`, borderTop: `1px solid ${cssVars.colors.border}` }}>
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
                      <div style={{ fontSize: cssVars.fontSizes.xxl, marginBottom: '4px' }}>{st.icon}</div>
                      <div style={{ fontSize: cssVars.fontSizes.sm }}>{st.label}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MonitorEditor;
