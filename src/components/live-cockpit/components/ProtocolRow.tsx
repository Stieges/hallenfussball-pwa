/**
 * ProtocolRow (M3): gemeinsame Protokoll-Zeile fuer Sidebar (Desktop) und EventLogBottomSheet
 * (Mobil) -- Icon, Beschreibung, Zeit, ⚠-Hinweis, Kennwort „zurueckgenommen“, Bearbeiten-Knopf.
 * Zurueckgenommene Eintraege sind durchgestrichen und nicht bearbeitbar (G6).
 */
import { type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import type { RuntimeMatchEvent } from '../../../types/tournament';
import { retractedMarkStyle, retractedRowStyle, formatTime, type ProtocolEntry } from './protocolEntries';

export interface ProtocolRowProps {
  entry: ProtocolEntry;
  description: string;
  variant: 'sidebar' | 'sheet';
  /** Sidebar: letzte Zeile ohne Trennlinie. */
  isLast?: boolean;
  /** BottomSheet: STATUS_CHANGE ist nicht bearbeitbar (BUG-002). */
  editable?: boolean;
  onEventEdit?: (event: RuntimeMatchEvent) => void;
}

const getEventIcon = (type: string): string => {
  switch (type) {
    case 'GOAL': return '⚽';
    case 'YELLOW_CARD': return '🟨';
    case 'RED_CARD': return '🟥';
    case 'TIME_PENALTY': return '⏱';
    case 'SUBSTITUTION': return '🔄';
    case 'FOUL': return '⚠';
    case 'STATUS_CHANGE': return '▶️';
    default: return '•';
  }
};

export function ProtocolRow({
  entry,
  description,
  variant,
  isLast = false,
  editable = true,
  onEventEdit,
}: ProtocolRowProps) {
  const { t } = useTranslation('cockpit');
  const { event, retracted } = entry;
  const icon = getEventIcon(event.type);
  const time = formatTime(event.timestampSeconds);
  const isIncomplete = !retracted && event.incomplete === true;
  const canEdit = !!onEventEdit && !retracted && editable;

  const sidebarRowStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${cssVars.spacing.sm} 0`,
    borderBottom: `1px solid ${cssVars.colors.borderSolid}`,
    fontSize: cssVars.fontSizes.sm,
  };

  const sheetRowStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: cssVars.spacing.md,
    backgroundColor: cssVars.colors.surfaceElevated,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    minHeight: 56,
  };

  const rowStyle: CSSProperties = variant === 'sidebar'
    ? {
        ...sidebarRowStyle,
        borderBottom: isLast ? 'none' : sidebarRowStyle.borderBottom,
        ...(retracted ? retractedRowStyle : {}),
      }
    : { ...sheetRowStyle, ...(retracted ? retractedRowStyle : {}) };

  const incompleteStyle: CSSProperties = {
    color: cssVars.colors.warning,
    marginLeft: cssVars.spacing.xs,
  };

  const logEntryRightStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
  };

  const logTimeStyle: CSSProperties = {
    color: cssVars.colors.textMuted,
    fontVariantNumeric: 'tabular-nums',
  };

  const sidebarEditButtonStyle: CSSProperties = {
    background: 'transparent',
    border: 'none',
    padding: cssVars.spacing.xs,
    cursor: 'pointer',
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textMuted,
    borderRadius: cssVars.borderRadius.sm,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'color 0.15s ease',
    minWidth: 28,
    minHeight: 28,
  };

  const eventInfoStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    flex: 1,
    overflow: 'hidden',
  };

  const iconStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.lg,
    flexShrink: 0,
  };

  const timeStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.semibold,
    fontVariantNumeric: 'tabular-nums',
    color: cssVars.colors.textSecondary,
    flexShrink: 0,
    minWidth: 50,
  };

  const descStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textPrimary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const sheetEditButtonStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: cssVars.spacing.sm,
    backgroundColor: cssVars.colors.primary,
    color: cssVars.colors.onPrimary,
    border: 'none',
    borderRadius: cssVars.borderRadius.sm,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.medium,
    cursor: 'pointer',
    minWidth: 80,
    minHeight: 44,
  };

  const warning = isIncomplete ? <span style={incompleteStyle}>⚠️</span> : null;
  const mark = retracted ? (
    <span style={retractedMarkStyle} data-testid="event-retracted-mark">
      {t('sidebar.retractedMark')}
    </span>
  ) : null;

  const handleEditClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    onEventEdit?.(event);
  };

  return (
    <div
      style={rowStyle}
      data-testid={retracted ? 'event-row-retracted' : undefined}
      aria-label={retracted ? t('sidebar.retractedAria', { description }) : undefined}
    >
      {variant === 'sidebar' ? (
        <>
          <span>
            {icon} {description}
            {warning}
            {mark}
          </span>
          <div style={logEntryRightStyle}>
            <span style={logTimeStyle}>{time}</span>
            {canEdit && (
              <button
                style={sidebarEditButtonStyle}
                onClick={handleEditClick}
                aria-label={t('sidebar.editAria', { description })}
                title={t('sidebar.edit')}
              >
                ✏️
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <div style={eventInfoStyle}>
            <span style={iconStyle}>{icon}</span>
            <span style={timeStyle}>{time}</span>
            <span style={descStyle}>
              {description}
              {warning}
              {mark}
            </span>
          </div>
          {canEdit && (
            <button style={sheetEditButtonStyle} onClick={handleEditClick} aria-label={`${description} bearbeiten`}>
              ✏️ Bearbeiten
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default ProtocolRow;
