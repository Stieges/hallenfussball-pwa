/**
 * Einsatz-Karte(n) oben auf der Startseite (A-17c-2, @HE-109): „Du hilfst beim <Turnier> · Feld <n> · <Wochentag>“. Ein Tipp
 * öffnet das Feld. Erscheint für jeden zugelassenen, nicht abgeschlossenen Helfer-Zugang des Geräts – vor dem Turniertag (läuft
 * nichts, bleibt die Startseite stehen) und auch, wenn Tom vom Feld über „Meine Turniere auf diesem Handy“ hierher kommt.
 * Geräte ohne Zugangs-Index laden nichts und zeigen nichts. Darunter folgen Toms eigene Turniere (die Startseite selbst).
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { Icons } from '../../../components/ui/Icons';
import { cssVars, dialogWidths, iconSizeValues } from '../../../design-tokens';
import type { HelperAccessEntry } from '../../../core/repositories/helperAccessRpc';
import { captureFeatureError } from '../../../lib/sentry';
import { hasStoredHelperAccessIndex } from '../helperAccessStore';
import { loadHelperStartContext, type HelperStartContextDeps } from '../helperStartContext';
import { defaultHelperStartDeps } from '../helperStartDeps';
import { formatJoinWeekday, helperFieldPath } from '../joinPaths';
import { isOpenAssignment } from '../runningState';

export interface HelperAssignmentCardsProps {
  /** Nur für Tests. */
  deps?: HelperStartContextDeps;
}

export const HelperAssignmentCards = ({ deps }: HelperAssignmentCardsProps) => {
  const { t, i18n } = useTranslation('helpers');
  const navigate = useNavigate();
  const [entries, setEntries] = useState<HelperAccessEntry[]>([]);

  useEffect(() => {
    if (!hasStoredHelperAccessIndex()) {
      return undefined;
    }
    let cancelled = false;
    loadHelperStartContext(deps ?? defaultHelperStartDeps())
      .then((context) => {
        if (!cancelled && context.session.kind !== 'account') {
          setEntries(context.entries.filter(isOpenAssignment).sort((a, b) => a.date.localeCompare(b.date)));
        }
      })
      .catch((error: unknown) => {
        if (error instanceof Error) {
          captureFeatureError(error, 'helpers', 'assignmentCards');
        }
      });
    return () => { cancelled = true; };
  }, [deps]);

  if (entries.length === 0) {
    return null;
  }
  return (
    <ul
      style={{ listStyle: 'none', margin: '0 auto', padding: `${cssVars.spacing.md} ${cssVars.spacing.md} 0`, display: 'grid', gap: cssVars.spacing.sm, maxWidth: dialogWidths.md }}
      data-testid="helper-assignment-cards"
    >
      {entries.map((entry) => (
        <li key={entry.tournamentId}>
          <Button
            variant="secondary"
            fullWidth
            onClick={() => void navigate(helperFieldPath(entry.tournamentId, entry.field ?? 1))}
            style={{ minHeight: cssVars.touchTargets.primary, justifyContent: 'space-between', textAlign: 'left' }}
            data-testid={`helper-assignment-${entry.tournamentId}`}
          >
            <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
              {t('join.assignment.card', {
                title: entry.title,
                field: entry.field === null ? t('join.chooser.noField') : t('join.chooser.field', { field: entry.field }),
                weekday: formatJoinWeekday(entry.date, i18n.language),
              })}
            </span>
            <Icons.ChevronRight size={iconSizeValues.sm} />
          </Button>
        </li>
      ))}
    </ul>
  );
};
