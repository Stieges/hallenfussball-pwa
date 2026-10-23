/**
 * Auswahl „Wohin geht es?“ (A-17c, Mockup M3 n4, @HE-099): Ein Gerät mit Zugängen zu zwei laufenden Turnieren zeigt beide mit
 * seinem Feld statt der Startseite. Keine Haupttaste – beide Wege sind gleichwertig, jede Zeile ist 56 px hoch. „Zur
 * Startseite“ bleibt immer erreichbar (Gast-Turniere bleiben sichtbar, Pflichtzeile GA5 v2.1).
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { Icons } from '../../../components/ui/Icons';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import type { HelperAccessEntry } from '../../../core/repositories/helperAccessRpc';
import { captureFeatureError } from '../../../lib/sentry';
import { isRunningAccess } from '../helperStartTarget';
import { loadHelperStartContext, type HelperStartContextDeps } from '../helperStartContext';
import { defaultHelperStartDeps } from '../helperStartDeps';
import { formatJoinDate, helperFieldPath } from '../joinPaths';
import { JoinShell } from './JoinShell';

export interface HelperTournamentChooserProps {
  /** Nur für Tests. */
  deps?: HelperStartContextDeps;
}

export const HelperTournamentChooser = ({ deps }: HelperTournamentChooserProps) => {
  const { t, i18n } = useTranslation('helpers');
  const navigate = useNavigate();
  const [entries, setEntries] = useState<HelperAccessEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadHelperStartContext(deps ?? defaultHelperStartDeps())
      .then((context) => { if (!cancelled) { setEntries(context.entries.filter(isRunningAccess)); } })
      .catch((error: unknown) => {
        if (error instanceof Error) {
          captureFeatureError(error, 'helpers', 'chooser');
        }
        if (!cancelled) { setEntries([]); }
      });
    return () => { cancelled = true; };
  }, [deps]);

  const row = { minHeight: cssVars.touchTargets.primary, justifyContent: 'space-between', textAlign: 'left' } as const;
  return (
    <JoinShell>
      <h2 style={{ margin: 0, fontSize: cssVars.fontSizes.lg }}>{t('join.chooser.title')}</h2>
      {entries === null ? (
        <p role="status" aria-busy="true">{t('join.chooser.checking')}</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: cssVars.spacing.sm }} data-testid="helper-chooser">
          {entries.map((entry) => (
            <li key={entry.tournamentId}>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => void navigate(helperFieldPath(entry.tournamentId, entry.field ?? 1))}
                style={row}
                data-testid={`helper-chooser-${entry.tournamentId}`}
              >
                <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                  <b>{entry.title}</b>
                  <small style={{ display: 'block', color: cssVars.colors.textSecondary, fontWeight: cssVars.fontWeights.normal }}>
                    {t('join.chooser.fieldAndDate', {
                      field: entry.field === null ? t('join.chooser.noField') : t('join.chooser.field', { field: entry.field }),
                      date: formatJoinDate(entry.date, i18n.language),
                    })}
                  </small>
                </span>
                <Icons.ChevronRight size={iconSizeValues.sm} />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button variant="ghost" fullWidth onClick={() => void navigate('/')} style={{ minHeight: cssVars.touchTargets.minimum }} data-testid="helper-chooser-home">
        {t('join.chooser.home')}
      </Button>
    </JoinShell>
  );
};
