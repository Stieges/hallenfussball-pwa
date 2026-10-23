/**
 * Auswahl „Wohin geht es?“ (A-17c, Mockup M3 n4, @HE-099): Ein Gerät mit zwei laufenden Turnieren zeigt beide statt der
 * Startseite – Helfer-Zugänge mit seinem Feld, eigene laufende Turniere des Geräts zählen wie ein Zugang und stehen mit drin. Keine Haupttaste – beide Wege sind gleichwertig, jede Zeile ist 56 px hoch. „Zur
 * Startseite“ bleibt immer erreichbar (eigene Turniere des Geräts stehen dort).
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { Icons } from '../../../components/ui/Icons';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import type { HelperAccessEntry } from '../../../core/repositories/helperAccessRpc';
import { captureFeatureError } from '../../../lib/sentry';
import type { Tournament } from '../../../types/tournament';
import { isRunningHelperEntry, isRunningOwnTournament, toDateKey } from '../runningState';
import { loadHelperStartContext, type HelperStartContextDeps } from '../helperStartContext';
import { defaultHelperStartDeps, markHelperStartHandled } from '../helperStartDeps';
import { formatJoinDate, helperFieldPath, helperTournamentPath } from '../joinPaths';
import { JoinShell } from './JoinShell';

export interface HelperTournamentChooserProps {
  /** Lokale Turniere des Geräts; die laufenden eigenen (außerhalb des Zugangs-Index) stehen mit in der Auswahl. */
  tournaments?: readonly Tournament[];
  /** Nur für Tests. */
  deps?: HelperStartContextDeps;
}

interface ChooserRow {
  id: string;
  title: string;
  path: string;
  detail: string;
}

export const HelperTournamentChooser = ({ deps, tournaments = [] }: HelperTournamentChooserProps) => {
  const { t, i18n } = useTranslation('helpers');
  const navigate = useNavigate();
  const [entries, setEntries] = useState<HelperAccessEntry[] | null>(null);
  const ownRunning = useMemo(() => {
    const known = new Set((entries ?? []).map((entry) => entry.tournamentId));
    const now = new Date();
    return tournaments.filter((tournament) => !known.has(tournament.id) && isRunningOwnTournament(tournament, now));
  }, [entries, tournaments]);

  useEffect(() => {
    let cancelled = false;
    loadHelperStartContext(deps ?? defaultHelperStartDeps())
      .then((context) => { if (!cancelled) { setEntries(context.entries); } })
      .catch((error: unknown) => {
        if (error instanceof Error) {
          captureFeatureError(error, 'helpers', 'chooser');
        }
        if (!cancelled) { setEntries([]); }
      });
    return () => { cancelled = true; };
  }, [deps]);

  const row = { minHeight: cssVars.touchTargets.primary, justifyContent: 'space-between', textAlign: 'left' } as const;
  const now = new Date();
  const rows: ChooserRow[] = entries === null ? [] : [
    ...entries.filter((entry) => isRunningHelperEntry(entry, now)).map((entry) => ({
      id: entry.tournamentId,
      title: entry.title,
      path: helperFieldPath(entry.tournamentId, entry.field ?? 1),
      detail: t('join.chooser.fieldAndDate', {
        field: entry.field === null ? t('join.chooser.noField') : t('join.chooser.field', { field: entry.field }),
        date: formatJoinDate(entry.date, i18n.language),
      }),
    })),
    ...ownRunning.map((tournament) => ({
      id: tournament.id,
      title: tournament.title,
      path: helperTournamentPath(tournament.id),
      detail: t('join.chooser.own', { date: formatJoinDate(toDateKey(tournament.startDate ?? tournament.date) ?? tournament.date, i18n.language) }),
    })),
  ];
  return (
    <JoinShell>
      <h2 style={{ margin: 0, fontSize: cssVars.fontSizes.lg }}>{t('join.chooser.title')}</h2>
      {entries === null ? (
        <p role="status" aria-busy="true">{t('join.chooser.checking')}</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: cssVars.spacing.sm }} data-testid="helper-chooser">
          {rows.map((item) => (
            <li key={item.id}>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => void navigate(item.path)}
                style={row}
                data-testid={`helper-chooser-${item.id}`}
              >
                <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                  <b>{item.title}</b>
                  <small style={{ display: 'block', color: cssVars.colors.textSecondary, fontWeight: cssVars.fontWeights.normal }}>
                    {item.detail}
                  </small>
                </span>
                <Icons.ChevronRight size={iconSizeValues.sm} />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button variant="ghost" fullWidth onClick={() => { markHelperStartHandled(); void navigate('/'); }} style={{ minHeight: cssVars.touchTargets.minimum }} data-testid="helper-chooser-home">
        {t('join.chooser.home')}
      </Button>
    </JoinShell>
  );
};
