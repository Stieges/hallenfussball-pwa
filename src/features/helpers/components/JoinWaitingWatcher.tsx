/**
 * Warteschirm mit Abfrage (A-17c, @HE-001, @OB-053): zeigt die Prüfzahl, fragt alle 2 s den Zugangsstatus und wechselt
 * von allein auf „Du bist zugelassen“ (kein neuer Scan nötig) oder auf den passenden Endzustand (abgelehnt, entzogen …).
 * Solange die Antwort noch pending ist, bleibt der Warteschirm stehen.
 */
import { JoinEndState } from './JoinEndState';
import { JoinApproved } from './JoinApproved';
import { JoinWaitingCard } from './JoinWaitingCard';
import type { JoinTournament } from '../joinFlow';
import { useHelperAccessStatus, type HelperStatusDeps } from '../useHelperAccessStatus';

export interface JoinWaitingWatcherProps {
  tournament: JoinTournament | null;
  name: string;
  checkNumber: number | null;
  deviceUserId: string | null;
  /** Nur für Tests. */
  statusDeps?: HelperStatusDeps;
  loadOfflineCopy?: (tournamentId: string) => Promise<boolean>;
  onNavigate: (path: string) => void;
  onHome: () => void;
  onRecheck: () => void;
}

export const JoinWaitingWatcher = ({
  tournament, name, checkNumber, deviceUserId, statusDeps, loadOfflineCopy, onNavigate, onHome, onRecheck,
}: JoinWaitingWatcherProps) => {
  const { outcome, view, info } = useHelperAccessStatus(tournament?.id ?? null, {
    enabled: tournament !== null,
    deviceUserId,
    deps: statusDeps,
  });
  if (outcome?.kind === 'allowed' && tournament) {
    return (
      <JoinApproved
        tournament={tournament}
        field={info?.field ?? null}
        deviceUserId={deviceUserId}
        loadOfflineCopy={loadOfflineCopy}
        onNavigate={onNavigate}
      />
    );
  }
  if (view && outcome && outcome.kind !== 'pending' && outcome.kind !== 'none') {
    return <JoinEndState view={view} tournament={tournament} onNavigate={onNavigate} onHome={onHome} onRecheck={onRecheck} />;
  }
  return <JoinWaitingCard tournament={tournament} name={name} checkNumber={checkNumber} />;
};
