/**
 * MonitorCard - Eine Monitor-Karte in der Monitor-Übersicht (aus MonitorsConfigTab ausgelagert, B-22)
 */

import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import type { TournamentMonitor } from '../../../types/monitor';
import type { HeartbeatStatus } from '../../../hooks/useMonitorHeartbeats';

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
                  width: cssVars.spacing.sm,
                  height: cssVars.spacing.sm,
                  borderRadius: cssVars.borderRadius.full,
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

export { MonitorCard };
