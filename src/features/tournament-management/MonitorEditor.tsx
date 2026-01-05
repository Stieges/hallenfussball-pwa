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

import { useState, useCallback, useMemo, useEffect, CSSProperties } from 'react';
import { cssVars } from '../../design-tokens';
import type { Tournament, TournamentField, TournamentGroup } from '../../types/tournament';
import type {
  MonitorSlide,
  SlideType,
  SlideConfig,
  TransitionType,
  PerformanceMode,
} from '../../types/monitor';
import { SLIDE_TYPES } from '../../types/monitor';
import { useMonitors, useSponsors, useFields } from '../../hooks';

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

const TRANSITION_OPTIONS: { value: TransitionType; label: string }[] = [
  { value: 'fade', label: 'Überblenden' },
  { value: 'slide', label: 'Schieben' },
  { value: 'none', label: 'Harter Schnitt' },
];

const PERFORMANCE_OPTIONS: { value: PerformanceMode; label: string; description: string }[] = [
  { value: 'auto', label: 'Automatisch', description: 'Erkennt Smart-TVs automatisch' },
  { value: 'high', label: 'Hoch', description: 'Alle Animationen aktiv' },
  { value: 'low', label: 'Energiesparen', description: 'Für ältere Smart-TVs' },
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
      return [{ id: 'default', customName: 'Alle Teams' }];
    }

    // If explicit groups are defined, use them
    if (tournament.groups && tournament.groups.length > 0) {
      return tournament.groups;
    }

    // If numberOfGroups is set, generate synthetic group entries
    const numGroups = tournament.numberOfGroups ?? 1;
    if (numGroups <= 1) {
      // Single group tournament - return one default group
      return [{ id: 'default', customName: 'Alle Teams' }];
    }

    // Generate group entries A, B, C, etc.
    return Array.from({ length: numGroups }, (_, i) => ({
      id: String.fromCharCode(65 + i), // A, B, C...
      customName: `Gruppe ${String.fromCharCode(65 + i)}`,
    }));
  }, [tournament.groups, tournament.numberOfGroups, tournament.groupSystem]);

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
  }) => {
    if (!monitor) {return;}

    setIsLoading(true);
    setError(null);

    try {
      await updateMonitor(monitorId, updates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setIsLoading(false);
    }
  }, [monitor, monitorId, updateMonitor]);

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
      setError(err instanceof Error ? err.message : 'Fehler beim Hinzufügen');
    } finally {
      setIsLoading(false);
    }
  }, [monitorId, addSlide]);

  const handleUpdateSlide = useCallback(async (
    slideId: string,
    updates: { config?: Partial<SlideConfig>; duration?: number | null }
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      await updateSlide(monitorId, slideId, updates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Aktualisieren');
    } finally {
      setIsLoading(false);
    }
  }, [monitorId, updateSlide]);

  const handleRemoveSlide = useCallback(async (slideId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      await removeSlide(monitorId, slideId);
      if (editingSlideId === slideId) {
        setEditingSlideId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Entfernen');
    } finally {
      setIsLoading(false);
    }
  }, [monitorId, removeSlide, editingSlideId]);

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
      setError(err instanceof Error ? err.message : 'Fehler beim Umordnen');
    } finally {
      setIsLoading(false);
    }
  }, [monitor, monitorId, reorderSlides]);

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
        const fieldName = config.fieldId ? getFieldDisplayName(config.fieldId) : 'Nicht konfiguriert';
        return fieldName;
      }
      case 'standings':
      case 'schedule-group': {
        const group = groups.find(g => g.id === config.groupId);
        return group?.customName || `Gruppe ${config.groupId}` || 'Nicht konfiguriert';
      }
      case 'sponsor': {
        const sponsor = sponsors.find(s => s.id === config.sponsorId);
        return sponsor?.name || 'Nicht konfiguriert';
      }
      case 'custom-text':
        return config.headline || 'Eigener Text';
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
        aria-label="Monitor nicht gefunden"
      >
        <div style={editorStyle} onClick={e => e.stopPropagation()}>
          <div style={headerStyle}>
            <h2 style={titleStyle}>Monitor nicht gefunden</h2>
            <button style={closeButtonStyle} onClick={onClose} aria-label="Schließen">✕</button>
          </div>
          <div style={contentStyle}>
            <p>Der Monitor mit ID &quot;{monitorId}&quot; existiert nicht mehr.</p>
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
          <button style={closeButtonStyle} onClick={onClose} aria-label="Schließen">✕</button>
        </div>

        {/* Content */}
        <div style={{ ...contentStyle, opacity: isLoading ? 0.6 : 1, pointerEvents: isLoading ? 'none' : 'auto' }}>
          {/* Error */}
          {error && <div style={errorStyle}>{error}</div>}

          {/* Settings Section */}
          <div style={sectionStyle}>
            <h3 style={sectionTitleStyle}>Einstellungen</h3>
            <div style={settingsGridStyle}>
              {/* Name */}
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Name</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={monitor.name}
                  onChange={(e) => void handleUpdateSettings({ name: e.target.value })}
                />
              </div>

              {/* Duration */}
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Slide-Dauer (Sek.)</label>
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
                <label style={labelStyle}>Übergang</label>
                <select
                  style={selectStyle}
                  value={monitor.transition}
                  onChange={(e) => void handleUpdateSettings({ transition: e.target.value as TransitionType })}
                >
                  {TRANSITION_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Performance Mode */}
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Performance</label>
                <select
                  style={selectStyle}
                  value={monitor.performanceMode}
                  onChange={(e) => void handleUpdateSettings({ performanceMode: e.target.value as PerformanceMode })}
                >
                  {PERFORMANCE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Slides Section */}
          <div style={sectionStyle}>
            <h3 style={sectionTitleStyle}>Slides ({monitor.slides.length})</h3>

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
                          title="Nach oben"
                        >
                          ↑
                        </button>
                        <button
                          style={iconButtonStyle}
                          onClick={() => void handleMoveSlide(slide.id, 'down')}
                          disabled={index === monitor.slides.length - 1}
                          title="Nach unten"
                        >
                          ↓
                        </button>
                        <button
                          style={iconButtonStyle}
                          onClick={() => setEditingSlideId(isEditing ? null : slide.id)}
                          title="Bearbeiten"
                        >
                          ✏️
                        </button>
                        <button
                          style={iconButtonStyle}
                          onClick={() => void handleRemoveSlide(slide.id)}
                          title="Entfernen"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* Slide Config (wenn bearbeitet) */}
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
                <span>Slide hinzufügen</span>
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

// =============================================================================
// SUB-COMPONENT: SlideConfigEditor
// =============================================================================

interface SlideConfigEditorProps {
  slide: MonitorSlide;
  fields: TournamentField[];
  groups: TournamentGroup[];
  sponsors: { id: string; name: string }[];
  onUpdate: (config: Partial<SlideConfig>, duration?: number | null) => void;
  getFieldDisplayName: (id: string) => string;
  styles: Record<string, CSSProperties>;
}

function SlideConfigEditor({
  slide,
  fields,
  groups,
  sponsors,
  onUpdate,
  getFieldDisplayName,
  styles,
}: SlideConfigEditorProps) {
  const { type, config, duration } = slide;

  const handleConfigChange = (key: keyof SlideConfig, value: SlideConfig[keyof SlideConfig]) => {
    onUpdate({ [key]: value });
  };

  const handleDurationChange = (value: string) => {
    const num = parseInt(value, 10);
    onUpdate({}, isNaN(num) || num <= 0 ? null : num);
  };

  return (
    <div style={styles.slideConfigStyle}>
      {/* Feld-Auswahl für live, schedule-field */}
      {(type === 'live' || type === 'schedule-field') && (
        <div style={styles.inputGroupStyle}>
          <label style={styles.labelStyle}>Spielfeld</label>
          <select
            style={styles.selectStyle}
            value={config.fieldId ?? ''}
            onChange={(e) => handleConfigChange('fieldId', e.target.value || undefined)}
          >
            <option value="">Bitte wählen...</option>
            {fields.map(f => (
              <option key={f.id} value={f.id}>{getFieldDisplayName(f.id)}</option>
            ))}
          </select>
        </div>
      )}

      {/* Gruppen-Auswahl für standings, schedule-group */}
      {(type === 'standings' || type === 'schedule-group') && groups.length > 1 && (
        <div style={styles.inputGroupStyle}>
          <label style={styles.labelStyle}>Gruppe</label>
          <select
            style={styles.selectStyle}
            value={config.groupId ?? ''}
            onChange={(e) => handleConfigChange('groupId', e.target.value || undefined)}
          >
            <option value="">Alle Gruppen</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>
                {g.customName || `Gruppe ${g.id}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Sponsor-Auswahl */}
      {type === 'sponsor' && (
        <>
          <div style={styles.inputGroupStyle}>
            <label style={styles.labelStyle}>Sponsor</label>
            <select
              style={styles.selectStyle}
              value={config.sponsorId ?? ''}
              onChange={(e) => handleConfigChange('sponsorId', e.target.value || undefined)}
            >
              <option value="">Bitte wählen...</option>
              {sponsors.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div style={{ ...styles.inputGroupStyle, marginTop: cssVars.spacing.sm }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: cssVars.spacing.sm, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={config.showQrCode !== false}
                onChange={(e) => handleConfigChange('showQrCode', e.target.checked)}
              />
              <span style={styles.labelStyle}>QR-Code anzeigen</span>
            </label>
          </div>
        </>
      )}

      {/* Custom Text */}
      {type === 'custom-text' && (
        <>
          <div style={styles.inputGroupStyle}>
            <label style={styles.labelStyle}>Überschrift</label>
            <input
              type="text"
              style={styles.inputStyle}
              value={config.headline ?? ''}
              onChange={(e) => handleConfigChange('headline', e.target.value)}
              placeholder="z.B. Wichtige Ankündigung"
            />
          </div>
          <div style={{ ...styles.inputGroupStyle, marginTop: cssVars.spacing.sm }}>
            <label style={styles.labelStyle}>Text</label>
            <textarea
              style={{ ...styles.inputStyle, minHeight: '80px', resize: 'vertical' }}
              value={config.body ?? ''}
              onChange={(e) => handleConfigChange('body', e.target.value)}
              placeholder="Dein Text hier..."
            />
          </div>
        </>
      )}

      {/* Custom Duration */}
      <div style={{ ...styles.inputGroupStyle, marginTop: cssVars.spacing.sm }}>
        <label style={styles.labelStyle}>
          Eigene Dauer (Sek.) - leer = Monitor-Standard
        </label>
        <input
          type="number"
          style={{ ...styles.inputStyle, maxWidth: '100px' }}
          value={duration ?? ''}
          onChange={(e) => handleDurationChange(e.target.value)}
          placeholder="Standard"
          min="1"
          max="300"
        />
      </div>
    </div>
  );
}

export default MonitorEditor;
