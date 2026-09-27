/**
 * C2b: Hinweis/Badge auf nicht uebernommene Eintraege (D-C1) -- eigener Knopf NEBEN dem
 * Statusfeld von SyncStatusBar, damit der Klick die Ablehnungsliste (RejectedEntriesPanel)
 * zeigt. Fixrunde 1 (Review m4): aus SyncStatusBar ausgelagert, um dessen Groesse zu senken.
 */
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

export interface SyncRejectedHintProps {
  count: number;
  style: CSSProperties;
  onShowRejected?: () => void;
}

export function SyncRejectedHint({ count, style, onShowRejected }: SyncRejectedHintProps) {
  const { t } = useTranslation('common');
  const label = t('outbox.rejected.countLabel', { count });

  if (onShowRejected) {
    return (
      <button
        type="button"
        data-testid="sync-status-rejected"
        data-rejected={count}
        style={style}
        onClick={onShowRejected}
      >
        {label}
      </button>
    );
  }

  return (
    <span data-testid="sync-status-rejected" data-rejected={count} style={{ ...style, cursor: 'default' }}>
      {label}
    </span>
  );
}

export default SyncRejectedHint;
