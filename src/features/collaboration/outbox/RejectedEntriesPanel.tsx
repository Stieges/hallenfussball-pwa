/**
 * Ablehnungsliste (D-C1, C2b): Eintraege, die der Server nicht uebernommen hat,
 * mit „was es war“ und Klartext-Grund. „Verstanden“ (dismissRejected) nimmt sie
 * aus der Liste – geloescht wird nichts.
 */
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import type { RejectedEntry } from '../../../core/match/client/matchCopy';
import { cssVars } from '../../../design-tokens';
import {
  describeEvent,
  isUnknownReason,
  rejectionReasonKey,
  type EventTeams,
} from './rejectionText';

export interface RejectedEntriesPanelProps {
  entries: RejectedEntry[];
  onDismiss: (ids: string[]) => void;
  teams?: EventTeams;
}

const styles = {
  panel: {
    background: cssVars.colors.errorLight,
    border: `1px solid ${cssVars.colors.error}`,
    borderRadius: cssVars.borderRadius.md,
    padding: cssVars.spacing.sm,
    color: cssVars.colors.textPrimary,
  },
  header: { margin: 0, fontSize: cssVars.fontSizes.bodySm, fontWeight: cssVars.fontWeights.semibold },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: cssVars.spacing.xs },
  item: { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.xs, fontSize: cssVars.fontSizes.bodySm },
  reason: { color: cssVars.colors.textMuted, fontSize: cssVars.fontSizes.xs },
} as const;

function RejectedEntryRow({
  entry,
  teams,
  onDismiss,
}: {
  entry: RejectedEntry;
  teams?: EventTeams;
  onDismiss: (ids: string[]) => void;
}) {
  const { t } = useTranslation('common');
  const handleDismiss = useCallback(() => onDismiss([entry.event.id]), [onDismiss, entry.event.id]);
  const desc = describeEvent(entry, teams);
  const reasonKey = rejectionReasonKey(entry.code);
  return (
    <li data-testid="outbox-rejected-item" style={styles.item}>
      <span>
        {t(desc.key, {
          defaultValue: desc.key,
          what: t(desc.values.typeKey, { defaultValue: desc.values.typeKey }),
          team: desc.values.team,
          minute: desc.values.minute,
        })}
      </span>
      <span style={styles.reason}>
        {t(reasonKey, { defaultValue: reasonKey })}
        {isUnknownReason(reasonKey) ? ` (${String(t('outbox.rejected.unknownCodeHint', { code: entry.code }))})` : ''}
      </span>
      <Button data-testid="outbox-rejected-dismiss" variant="ghost" onClick={handleDismiss}>
        {t('actions.understood')}
      </Button>
    </li>
  );
}

export function RejectedEntriesPanel({ entries, onDismiss, teams }: RejectedEntriesPanelProps) {
  const { t } = useTranslation('common');
  const dismissAll = useCallback(() => onDismiss(entries.map((entry) => entry.event.id)), [onDismiss, entries]);
  if (entries.length === 0) {
    return null;
  }
  return (
    <section data-testid="outbox-rejected-panel" role="alert" style={styles.panel}>
      <h3 style={styles.header}>{t('outbox.rejected.header', { count: entries.length })}</h3>
      <ul style={styles.list}>
        {entries.map((entry) => (
          <RejectedEntryRow key={entry.event.id} entry={entry} teams={teams} onDismiss={onDismiss} />
        ))}
      </ul>
      <Button data-testid="outbox-rejected-dismiss-all" variant="ghost" onClick={dismissAll}>
        {t('outbox.rejected.dismissAll')}
      </Button>
    </section>
  );
}
