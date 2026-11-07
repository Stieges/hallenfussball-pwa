/**
 * Der gespeicherte Endstand für den PDF-Dialog der Turnierleitung (@DR-011, @DR-009, @ET-045): gelesen, sobald der Dialog offen
 * und das Turnier abgeschlossen ist, und bei jedem erneuten Öffnen frisch (ein neuer Abschluss nach dem Wiederöffnen gilt sofort).
 * Dieselbe Zeile wie die Endstand-Ansicht (`readStoredFinalStandings`), nie eine Neuberechnung.
 */
import { useEffect, useState } from 'react';
import { readStoredFinalStandings, type StoredFinalStandingsResult } from '../../../core/repositories/storedFinalStandingsRead';
import { isSupabaseConfigured, supabase } from '../../../lib/supabase';
import type { Tournament } from '../../../types/tournament';
import { isFinished, storedFinalSource, type FinalPdfSource } from './finalPdfSource';

type Stored = { status: 'loading' } | StoredFinalStandingsResult;

export function useStoredFinalPdfSource(tournament: Pick<Tournament, 'id' | 'lifecycleStatus' | 'finishedAt' | 'teams'>, open: boolean): FinalPdfSource {
  const [stored, setStored] = useState<Stored>({ status: 'loading' });
  const enabled = open && isFinished(tournament);
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    let alive = true;
    setStored({ status: 'loading' });
    void readStoredFinalStandings(isSupabaseConfigured ? supabase : null, tournament.id).then((result) => {
      if (alive) {
        setStored(result);
      }
    });
    return () => {
      alive = false;
    };
  }, [enabled, tournament.id, tournament.finishedAt]);
  return storedFinalSource(tournament, stored);
}
