/**
 * B-50 Review M2: Hook um `uebergabeFor`. Hat das Gerät das Recht zurück (und Netz – die Rolle ist dann vom Server bestätigt,
 * nicht nur aus dem Gedächtnis), schließt es die übergebenen Einträge dieses Spiels ab; der Hinweis verschwindet.
 */
import { useEffect, useMemo } from 'react';
import type { OutboxStatus } from '../../core/match/client/outboxTypes';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useMatchEngineContextOptional } from '../match-engine/useMatchEngineContext';
import { uebergabeFor, type Uebergabe } from './zugriffEntzogen';

export function useUebergabe(status: OutboxStatus, matchId: string | undefined, kannSteuern: boolean): Uebergabe {
  const context = useMatchEngineContextOptional();
  const { isOnline } = useOnlineStatus();
  const uebergabe = useMemo(() => uebergabeFor(status, matchId, kannSteuern), [status, matchId, kannSteuern]);
  const abschliessen = uebergabe?.art === 'abschliessen' && isOnline && matchId !== undefined ? matchId.toLowerCase() : null;
  const sender = context?.sender;
  useEffect(() => {
    if (abschliessen !== null && sender) {
      void sender.closeHandedOver(abschliessen).catch(() => undefined);
    }
  }, [abschliessen, sender]);
  return uebergabe?.art === 'abschliessen' ? null : uebergabe;
}
