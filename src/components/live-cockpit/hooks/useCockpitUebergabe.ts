/**
 * useCockpitUebergabe: der Ausgangs-Zustand des Geräts und was daraus für die Hülle folgt – Ausgang (W1, Nachtrag C3a-2a),
 * Übergabe an die Klärungsliste bei entzogenem Recht (B-50, @HE-056, @FU-017) und die verworfenen Klärungseinträge im Spielprotokoll
 * (B-50, @FU-095, B6.3). Aus `LiveCockpit.tsx` gelöst (H4-12), Verhalten gleich.
 */
import { useCallback, useMemo } from 'react';
import { useMatchEngineContextOptional } from '../../../features/match-engine/useMatchEngineContext';
import { useOutboxStatus } from '../../../features/collaboration/outbox/useOutboxStatus';
import { useUebergabe } from '../../../features/klaerungsliste/useUebergabe';
import { useVerworfeneEintraege } from '../../../features/klaerungsliste/useVerworfeneEintraege';
import type { LiveCockpitProps, LiveMatch } from '../types';

export function useCockpitUebergabe(props: Pick<LiveCockpitProps, 'tournamentId' | 'currentMatch' | 'kannSteuern' | 'istLeitung' | 'zugriffEntzogen'>) {
  const { tournamentId, currentMatch, kannSteuern, istLeitung = false } = props;
  const matchEngineContext = useMatchEngineContextOptional();
  const outboxStatus = useOutboxStatus(matchEngineContext?.sender ?? null);
  const handleOutboxReload = useCallback(() => window.location.reload(), []);
  // B-50 (@HE-056, @FU-017): hat der Server Einträge dieses Geräts wegen entzogenen Rechts zur Klärung gelegt
  // B-50 Review M2: nur Spiele mit übergebenen Einträgen; Recht zurück schließt ab, Zuschauer behält die Lesesicht
  const uebergabe = useUebergabe(outboxStatus, currentMatch?.id, kannSteuern);
  const zugriffEntzogen = props.zugriffEntzogen ?? (uebergabe?.art === 'sperre' ? { uebergebeneEintraege: uebergabe.count } : null);
  // B-50 (@FU-095, B6.3): verworfene Klärungseinträge stehen im Spielprotokoll der Turnierleitung (zählen nicht)
  const verworfene = useVerworfeneEintraege(tournamentId, currentMatch, istLeitung);
  const matchMitVerlauf = useMemo<LiveMatch | null>(
    () => (currentMatch && verworfene.length > 0 ? { ...currentMatch, discardedEntries: verworfene } : currentMatch),
    [currentMatch, verworfene],
  );
  return { outboxStatus, handleOutboxReload, uebergabe, zugriffEntzogen, matchMitVerlauf };
}
