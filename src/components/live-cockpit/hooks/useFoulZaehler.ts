/**
 * useFoulZaehler – die Foul-Zahlen des Cockpits (@SL-034, @SL-035, @SL-036, @SL-098, @SL-099, @SL-100, @SL-102).
 *
 * `halbzeit` = Fouls je Team im aktuellen Abschnitt (die Zahl gegen die Grenze, „Foul 3/5“; mit jedem Abschnitt neu, die Verlängerung zählt zum
 * letzten Abschnitt weiter); `gesamt` = Fouls je Team im ganzen Spiel (nur die Zusammenfassung nach dem Abpfiff). Die Meldung „n. Foul in dieser
 * Halbzeit“ folgt der Zahl der Halbzeit und der Grenze der Turnierregeln (`foulLimit`; ausgeschaltet = keine Meldung).
 */
import { useMemo } from 'react';
import { useFoulCounts, zaehleFouls } from '../../../hooks/useFoulCounts';
import { useFoulThresholdWarning } from '../../../hooks/useFoulThresholdWarning';
import type { PhaseView } from '../engine/phaseView';
import type { LiveMatch } from '../types';

export interface FoulZaehler { halbzeit: { home: number; away: number }; gesamt: { home: number; away: number } }

export function useFoulZaehler(
  match: LiveMatch | null,
  view: PhaseView | null,
  foulLimit: number | null,
  melde: (teamName: string, count: number) => void,
): FoulZaehler {
  const gesamt = useFoulCounts(match);
  const abschnitt = view ? { aktuell: view.section, gesamt: view.sections } : null;
  const aktuell = abschnitt?.aktuell;
  const sektionen = abschnitt?.gesamt;
  const halbzeit = useMemo(
    () => zaehleFouls(match, aktuell === undefined || sektionen === undefined ? null : { aktuell, gesamt: sektionen }),
    [match, aktuell, sektionen],
  );
  useFoulThresholdWarning(
    halbzeit,
    { home: match?.homeTeam.name ?? '', away: match?.awayTeam.name ?? '' },
    melde, match?.id, foulLimit,
  );
  return useMemo(() => ({ halbzeit, gesamt }), [halbzeit, gesamt]);
}
