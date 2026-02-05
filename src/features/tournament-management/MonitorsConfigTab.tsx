/**
 * MonitorsConfigTab - Monitor-Konfigurator Übersicht
 *
 * MON-KONF-01: Ermöglicht die Konfiguration beliebig vieler Display-Setups
 *
 * Features:
 * - Liste aller konfigurierten Monitore
 * - Neuen Monitor erstellen
 * - Monitor bearbeiten, löschen, duplizieren
 * - Display-URL kopieren
 * - Quick Preview der Slides
 *
 * @see MONITOR-KONFIGURATOR-UMSETZUNGSPLAN-v2.md P1-04
 */

import { useState, useCallback, useEffect, useRef, CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../design-tokens';
import type { Tournament } from '../../types/tournament';
import type { TournamentMonitor } from '../../types/monitor';
import { SLIDE_TYPES } from '../../types/monitor';
import { useMonitors } from '../../hooks';
import { useMonitorHeartbeats } from '../../hooks/useMonitorHeartbeats';
import type { HeartbeatStatus } from '../../hooks/useMonitorHeartbeats';

// =============================================================================
// TYPES
// =============================================================================

interface MonitorsConfigTabProps {
  tournament: Tournament;
  onTournamentUpdate: (tournament: Tournament) => Promise<void>;
  onEditMonitor?: (monitorId: string) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function MonitorsConfigTab({
  tournament,
  onTournamentUpdate,
  onEditMonitor,
}: MonitorsConfigTabProps) {
  const { t } = useTranslation('tournament');

  // State
  const [isCreating, setIsCreating] = useState(false);
  const [newMonitorName, setNewMonitorName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Ref for timeout cleanup
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current);
      }
    };
  }, []);

  // Hook
  const {
    monitors,
    createMonitor,
    deleteMonitor,
    duplicateMonitor,
    getDisplayUrl,
  } = useMonitors(tournament, onTournamentUpdate);

  // Heartbeat status for all monitors in this tournament
  const heartbeats = useMonitorHeartbeats(tournament.id);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handleStartCreate = () => {
    setNewMonitorName('');
    setIsCreating(true);
    setError(null);
  };

  const handleCancelCreate = () => {
    setNewMonitorName('');
    setIsCreating(false);
    setError(null);
  };

  const handleCreate = async () => {
    const trimmedName = newMonitorName.trim();

    if (!trimmedName) {
      setError(t('monitors.errors.nameRequired'));
      return;
    }

    if (trimmedName.length > 50) {
      setError(t('monitors.errors.nameTooLong'));
      return;
    }

    // Check for duplicate names
    if (monitors.some(m => m.name.toLowerCase() === trimmedName.toLowerCase())) {
      setError(t('monitors.errors.duplicateName'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const newMonitor = await createMonitor(trimmedName);
      setIsCreating(false);
      setNewMonitorName('');

      // Optional: Direkt zum Editor wechseln
      if (onEditMonitor) {
        onEditMonitor(newMonitor.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('monitors.errors.createFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (monitorId: string) => {
    if (onEditMonitor) {
      onEditMonitor(monitorId);
    }
  };

  const handleDelete = async (id: string) => {
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await deleteMonitor(id);
      setDeleteConfirmId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('monitors.errors.deleteFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirmId(null);
  };

  const handleDuplicate = async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      await duplicateMonitor(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('monitors.errors.duplicateFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyUrl = useCallback(async (monitorId: string) => {
    const url = `${window.location.origin}${getDisplayUrl(monitorId)}`;

    // Clear any existing timeout
    if (copiedTimeoutRef.current) {
      clearTimeout(copiedTimeoutRef.current);
    }

    try {
      // Use clipboard API with fallback for older browsers
      await navigator.clipboard.writeText(url);

      setCopiedId(monitorId);
      copiedTimeoutRef.current = setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
      setError(t('monitors.errors.copyFailed'));
    }
  }, [getDisplayUrl, t]);

  const handleOpenDisplay = (monitorId: string) => {
    const url = getDisplayUrl(monitorId);
    window.open(url, '_blank');
  };

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  const getSlideTypeLabel = (type: string): string => {
    const meta = SLIDE_TYPES.find(s => s.type === type);
    return meta?.label ?? type;
  };

  const getSlideTypeIcon = (type: string): string => {
    const meta = SLIDE_TYPES.find(s => s.type === type);
    return meta?.icon ?? '📄';
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) {return `${seconds}s`;}
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  // ==========================================================================
  // STYLES
  // ==========================================================================

  const containerStyle: CSSProperties = {
    padding: cssVars.spacing.lg,
    background: cssVars.colors.background,
    minHeight: 'calc(100vh - 200px)',
  };

  const contentStyle: CSSProperties = {
    maxWidth: '900px',
    margin: '0 auto',
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: cssVars.spacing.lg,
    flexWrap: 'wrap',
    gap: cssVars.spacing.md,
  };

  const titleStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xl,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
    margin: 0,
  };

  const subtitleStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    marginTop: cssVars.spacing.xs,
  };

  const addButtonStyle: CSSProperties = {
    minWidth: '44px',
    minHeight: '44px',
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.lg}`,
    borderRadius: cssVars.borderRadius.md,
    background: cssVars.colors.primary,
    color: 'white',
    border: 'none',
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.semibold,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
  };

  const listStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.md,
  };

  const monitorCardStyle: CSSProperties = {
    padding: cssVars.spacing.lg,
    background: cssVars.colors.surface,
    borderRadius: cssVars.borderRadius.lg,
    border: `1px solid ${cssVars.colors.border}`,
  };

  const monitorHeaderStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: cssVars.spacing.md,
    marginBottom: cssVars.spacing.md,
  };

  const monitorNameStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
    margin: 0,
  };

  const monitorMetaStyle: CSSProperties = {
    display: 'flex',
    gap: cssVars.spacing.md,
    flexWrap: 'wrap',
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
  };

  const slidesPreviewStyle: CSSProperties = {
    display: 'flex',
    gap: cssVars.spacing.xs,
    flexWrap: 'wrap',
    marginTop: cssVars.spacing.md,
    padding: cssVars.spacing.sm,
    background: cssVars.colors.surfaceLight,
    borderRadius: cssVars.borderRadius.md,
  };

  const slideChipStyle: CSSProperties = {
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    background: cssVars.colors.surface,
    borderRadius: cssVars.borderRadius.sm,
    fontSize: cssVars.fontSizes.xs,
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  };

  const actionsStyle: CSSProperties = {
    display: 'flex',
    gap: cssVars.spacing.sm,
    marginTop: cssVars.spacing.md,
    flexWrap: 'wrap',
  };

  const actionButtonStyle = (variant: 'primary' | 'secondary' | 'danger' = 'secondary'): CSSProperties => ({
    minWidth: '44px',
    minHeight: '44px',
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    borderRadius: cssVars.borderRadius.md,
    background: variant === 'primary'
      ? cssVars.colors.primary
      : variant === 'danger'
        ? cssVars.colors.error
        : 'transparent',
    color: variant === 'primary' || variant === 'danger' ? 'white' : cssVars.colors.textSecondary,
    border: variant === 'secondary' ? `1px solid ${cssVars.colors.border}` : 'none',
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.medium,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
  });

  const createFormStyle: CSSProperties = {
    padding: cssVars.spacing.lg,
    background: cssVars.colors.surface,
    borderRadius: cssVars.borderRadius.lg,
    border: `1px solid ${cssVars.colors.primary}`,
    marginBottom: cssVars.spacing.lg,
  };

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: cssVars.spacing.md,
    borderRadius: cssVars.borderRadius.md,
    border: `1px solid ${cssVars.colors.border}`,
    background: cssVars.colors.background,
    color: cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.md,
    marginBottom: cssVars.spacing.md,
  };

  const emptyStateStyle: CSSProperties = {
    padding: cssVars.spacing.xxl,
    textAlign: 'center',
    color: cssVars.colors.textSecondary,
    background: cssVars.colors.surfaceLight,
    borderRadius: cssVars.borderRadius.lg,
    border: `1px dashed ${cssVars.colors.border}`,
  };

  const errorStyle: CSSProperties = {
    padding: cssVars.spacing.sm,
    background: `${cssVars.colors.error}22`,
    color: cssVars.colors.error,
    borderRadius: cssVars.borderRadius.sm,
    fontSize: cssVars.fontSizes.sm,
    marginBottom: cssVars.spacing.md,
  };

  const deleteConfirmStyle: CSSProperties = {
    marginTop: cssVars.spacing.md,
    padding: cssVars.spacing.md,
    background: `${cssVars.colors.error}15`,
    borderRadius: cssVars.borderRadius.md,
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.md,
    flexWrap: 'wrap',
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div style={containerStyle}>
      <div style={contentStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div>
            <h2 style={titleStyle}>{t('monitors.title')}</h2>
            <p style={subtitleStyle}>
              {t('monitors.subtitle')}
            </p>
          </div>
          {!isCreating && (
            <button style={addButtonStyle} onClick={handleStartCreate}>
              <span>+</span>
              <span>{t('monitors.addMonitor')}</span>
            </button>
          )}
        </div>

        {/* Error */}
        {error && <div style={errorStyle}>{error}</div>}

        {/* Create Form */}
        {isCreating && (
          <div style={createFormStyle}>
            <h3 style={{ margin: `0 0 ${cssVars.spacing.md}`, color: cssVars.colors.textPrimary }}>
              {t('monitors.createTitle')}
            </h3>
            <input
              type="text"
              style={inputStyle}
              placeholder={t('monitors.namePlaceholder')}
              value={newMonitorName}
              onChange={(e) => setNewMonitorName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {void handleCreate();}
                if (e.key === 'Escape') {handleCancelCreate();}
              }}
            />
            <div style={{ display: 'flex', gap: cssVars.spacing.sm, justifyContent: 'flex-end' }}>
              <button style={actionButtonStyle('secondary')} onClick={handleCancelCreate}>
                {t('monitors.cancel')}
              </button>
              <button
                style={actionButtonStyle('primary')}
                onClick={() => void handleCreate()}
                disabled={isLoading}
              >
                {isLoading ? t('monitors.creating') : t('monitors.createAndEdit')}
              </button>
            </div>
          </div>
        )}

        {/* Monitors List */}
        {monitors.length === 0 ? (
          <div style={emptyStateStyle}>
            <div style={{ fontSize: '48px', marginBottom: cssVars.spacing.md }}>📺</div>
            <h3 style={{ margin: 0, color: cssVars.colors.textPrimary }}>
              {t('monitors.emptyState')}
            </h3>
            <p style={{ margin: `${cssVars.spacing.sm} 0 0`, maxWidth: '400px', marginInline: 'auto' }}>
              {t('monitors.emptyStateHint')}
            </p>
          </div>
        ) : (
          <div style={listStyle}>
            {monitors.map((monitor) => (
              <MonitorCard
                key={monitor.id}
                monitor={monitor}
                heartbeatStatus={heartbeats.get(monitor.id)?.status ?? null}
                isDeleting={deleteConfirmId === monitor.id}
                isCopied={copiedId === monitor.id}
                onEdit={() => handleEdit(monitor.id)}
                onDelete={() => void handleDelete(monitor.id)}
                onCancelDelete={handleCancelDelete}
                onDuplicate={() => void handleDuplicate(monitor.id)}
                onCopyUrl={() => void handleCopyUrl(monitor.id)}
                onOpenDisplay={() => handleOpenDisplay(monitor.id)}
                getSlideTypeIcon={getSlideTypeIcon}
                getSlideTypeLabel={getSlideTypeLabel}
                formatDuration={formatDuration}
                styles={{
                  monitorCardStyle,
                  monitorHeaderStyle,
                  monitorNameStyle,
                  monitorMetaStyle,
                  slidesPreviewStyle,
                  slideChipStyle,
                  actionsStyle,
                  actionButtonStyle,
                  deleteConfirmStyle,
                }}
              />
            ))}
          </div>
        )}

        {/* Info Hint */}
        {monitors.length > 0 && (
          <p style={{
            marginTop: cssVars.spacing.lg,
            fontSize: cssVars.fontSizes.sm,
            color: cssVars.colors.textMuted,
            textAlign: 'center',
          }}>
            {t('monitors.displayUrlHint')}
          </p>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENT: MonitorCard
// =============================================================================

interface MonitorCardProps {
  monitor: TournamentMonitor;
  heartbeatStatus: HeartbeatStatus | null;
  isDeleting: boolean;
  isCopied: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onCancelDelete: () => void;
  onDuplicate: () => void;
  onCopyUrl: () => void;
  onOpenDisplay: () => void;
  getSlideTypeIcon: (type: string) => string;
  getSlideTypeLabel: (type: string) => string;
  formatDuration: (seconds: number) => string;
  styles: Record<string, CSSProperties | ((variant?: 'primary' | 'secondary' | 'danger') => CSSProperties)>;
}

function MonitorCard({
  monitor,
  heartbeatStatus,
  isDeleting,
  isCopied,
  onEdit,
  onDelete,
  onCancelDelete,
  onDuplicate,
  onCopyUrl,
  onOpenDisplay,
  getSlideTypeIcon,
  getSlideTypeLabel,
  formatDuration,
  styles,
}: MonitorCardProps) {
  const { t } = useTranslation('tournament');
  const actionButtonStyle = styles.actionButtonStyle as (variant?: 'primary' | 'secondary' | 'danger') => CSSProperties;

  return (
    <div style={styles.monitorCardStyle as CSSProperties}>
      {/* Header */}
      <div style={styles.monitorHeaderStyle as CSSProperties}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: cssVars.spacing.sm }}>
            <h3 style={{ ...(styles.monitorNameStyle as CSSProperties), margin: 0 }}>{monitor.name}</h3>
            {heartbeatStatus && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: cssVars.spacing.xs,
                  fontSize: cssVars.fontSizes.xs,
                  color: heartbeatStatus === 'online'
                    ? cssVars.colors.success
                    : heartbeatStatus === 'stale'
                      ? cssVars.colors.warning
                      : cssVars.colors.error,
                }}
                title={heartbeatStatus === 'online' ? t('monitors.heartbeat.online') : heartbeatStatus === 'stale' ? t('monitors.heartbeat.stale') : t('monitors.heartbeat.offline')}
              >
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: 'currentColor',
                  flexShrink: 0,
                }} />
                {heartbeatStatus === 'online' ? t('monitors.heartbeat.online') : heartbeatStatus === 'stale' ? t('monitors.heartbeat.staleShort') : t('monitors.heartbeat.offline')}
              </span>
            )}
          </div>
          <div style={styles.monitorMetaStyle as CSSProperties}>
            <span>{t('monitors.slidesCount', { count: monitor.slides.length })}</span>
            <span>•</span>
            <span>{t('monitors.perSlide', { duration: formatDuration(monitor.defaultSlideDuration) })}</span>
            <span>•</span>
            <span>{monitor.transition}</span>
          </div>
        </div>
      </div>

      {/* Slides Preview */}
      {monitor.slides.length > 0 && (
        <div style={styles.slidesPreviewStyle as CSSProperties}>
          {monitor.slides.slice(0, 8).map((slide) => (
            <span key={slide.id} style={styles.slideChipStyle as CSSProperties}>
              <span>{getSlideTypeIcon(slide.type)}</span>
              <span>{getSlideTypeLabel(slide.type)}</span>
            </span>
          ))}
          {monitor.slides.length > 8 && (
            <span style={styles.slideChipStyle as CSSProperties}>
              {t('monitors.moreSlides', { count: monitor.slides.length - 8 })}
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={styles.actionsStyle as CSSProperties}>
        <button
          style={actionButtonStyle('primary')}
          onClick={onEdit}
          aria-label={t('monitors.editAria', { name: monitor.name })}
        >
          ✏️ {t('monitors.edit')}
        </button>
        <button
          style={actionButtonStyle()}
          onClick={onOpenDisplay}
          aria-label={t('monitors.openAria', { name: monitor.name })}
        >
          🖥️ {t('monitors.open')}
        </button>
        <button
          style={actionButtonStyle()}
          onClick={onCopyUrl}
          aria-label={isCopied ? t('monitors.urlCopied') : t('monitors.copyUrlAria', { name: monitor.name })}
        >
          {isCopied ? t('monitors.copied') : t('monitors.copyUrl')}
        </button>
        <button
          style={actionButtonStyle()}
          onClick={onDuplicate}
          aria-label={t('monitors.duplicateAria', { name: monitor.name })}
        >
          📋 {t('monitors.duplicate')}
        </button>
        <button
          style={actionButtonStyle(isDeleting ? 'danger' : 'secondary')}
          onClick={onDelete}
          aria-label={isDeleting ? t('monitors.confirmDeleteAria', { name: monitor.name }) : t('monitors.deleteAria', { name: monitor.name })}
        >
          🗑️ {isDeleting ? t('monitors.confirm') : t('monitors.delete')}
        </button>
      </div>

      {/* Delete Confirmation */}
      {isDeleting && (
        <div
          role="alert"
          aria-live="polite"
          style={styles.deleteConfirmStyle as CSSProperties}
        >
          <span style={{ flex: 1, color: cssVars.colors.error }}>
            {t('monitors.deleteConfirmMessage', { name: monitor.name })}
          </span>
          <button
            style={actionButtonStyle('danger')}
            onClick={onDelete}
            aria-label={t('monitors.permanentDeleteAria', { name: monitor.name })}
          >
            {t('monitors.confirmDelete')}
          </button>
          <button
            style={actionButtonStyle()}
            onClick={onCancelDelete}
            aria-label={t('monitors.cancelDeleteAria')}
          >
            {t('monitors.cancel')}
          </button>
        </div>
      )}
    </div>
  );
}

export default MonitorsConfigTab;
