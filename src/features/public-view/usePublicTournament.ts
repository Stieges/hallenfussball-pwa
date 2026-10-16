/**
 * usePublicTournament – Datenzugriff der Zuschauer-Seite (B-13b).
 *
 * Lädt das Turnier per Share-Code über eine austauschbare Quelle, erzeugt Spielplan und
 * Gruppentabellen. Standard-Quelle: Supabase (nur wenn konfiguriert), dann lokaler Rückfall.
 * Die Quelle muss stabil sein (Modulkonstante oder useMemo), sonst lädt der Hook bei jedem Render neu.
 */
import { useState, useEffect, useCallback } from 'react';
import { anzeigeT } from '../../i18n/anzeigeSprache';
import { Tournament, Standing } from '../../types/tournament';
import { GeneratedSchedule, generateFullSchedule } from '../../core/generators';
import { calculateStandings } from '../../utils/calculations';
import { SupabaseRepository } from '../../core/repositories/SupabaseRepository';
import { LocalStorageRepository } from '../../core/repositories/LocalStorageRepository';
import { isSupabaseConfigured } from '../../lib/supabase';

export type LoadingState = 'loading' | 'error' | 'not-found' | 'success';

export interface PublicTournamentSource {
  getByShareCode(code: string): Promise<Tournament | null>;
}

/** Standard-Quelle: Supabase (falls konfiguriert), danach lokaler Speicher. Fehler werden protokolliert, nicht geworfen. */
export const defaultPublicTournamentSource: PublicTournamentSource = {
  async getByShareCode(code: string): Promise<Tournament | null> {
    let found: Tournament | null = null;

    if (isSupabaseConfigured) {
      try {
        const supabaseRepo = new SupabaseRepository();
        found = await supabaseRepo.getByShareCode(code);
      } catch (error) {
        console.warn('Supabase lookup failed, trying localStorage:', error);
      }
    }

    if (!found) {
      try {
        const localRepo = new LocalStorageRepository();
        found = await localRepo.getByShareCode(code);
      } catch (error) {
        console.warn('LocalStorage lookup failed:', error);
      }
    }

    return found;
  },
};

export interface PublicTournamentState {
  tournament: Tournament | null;
  schedule: GeneratedSchedule | null;
  standings: Standing[];
  loadingState: LoadingState;
  errorMessage: string | null;
  refresh: () => Promise<void>;
}

export function usePublicTournament(
  shareCode: string,
  source: PublicTournamentSource = defaultPublicTournamentSource
): PublicTournamentState {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [schedule, setSchedule] = useState<GeneratedSchedule | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadTournament = useCallback(async (isRefreshAction = false) => {
    if (!isRefreshAction) {
      setLoadingState('loading');
    }
    setErrorMessage(null);

    let found: Tournament | null = null;
    try {
      found = await source.getByShareCode(shareCode);
    } catch (error) {
      console.warn('Public tournament source failed:', error);
    }

    if (!found) {
      setLoadingState('not-found');
      return;
    }

    try {
      setTournament(found);

      const generatedSchedule = generateFullSchedule(found);
      setSchedule(generatedSchedule);

      const uniqueGroups = Array.from(
        new Set(found.teams.map((t) => t.group).filter(Boolean))
      ) as string[];

      const allStandings: Standing[] = [];
      uniqueGroups.forEach((group) => {
        const teamsInGroup = found.teams.filter((t) => t.group === group);
        const groupStandings = calculateStandings(
          teamsInGroup,
          found.matches,
          found,
          group
        );
        allStandings.push(...groupStandings);
      });

      setStandings(allStandings);
      setLoadingState('success');
    } catch (error) {
      console.error('Error loading tournament:', error);
      if (!isRefreshAction) {
        setLoadingState('error');
        setErrorMessage(anzeigeT('publicView:error.loadFailed'));
      }
    }
  }, [shareCode, source]);

  useEffect(() => {
    void loadTournament(false);
  }, [loadTournament]);

  const refresh = useCallback(() => loadTournament(true), [loadTournament]);

  return { tournament, schedule, standings, loadingState, errorMessage, refresh };
}
