/**
 * „Turnier abschließen“ in der Verwaltung (Plan R3-4 = B-33; @LZ-002, @LZ-005, @LZ-007, @LZ-008, @LZ-009, @LZ-022, E9):
 *   Läuft + alles entschieden    → Vorschlag „Alles entschieden – Endstand prüfen und Turnier abschließen“ (Haupttaste)
 *   Läuft + etwas offen          → Karte „Turnierstand“ mit „Turnier abschließen“ als zweiter Taste (öffnet Dialog A, @LZ-008)
 *   Abgeschlossen                → Zustand C (`FinishedStateSection`)
 * Nur mit Recht `manageLifecycle` (Helfer: bietet die App das nicht an, @LZ-022) und nur für Turniere mit Konto (E9). Der Dienst
 * bekommt den frisch gelesenen rohen Cloud-Stand, nie die Überlagerung der Anzeige (Review #393 H-2).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Tournament } from '../../../types/tournament';
import { LocalStorageRepository } from '../../../core/repositories/LocalStorageRepository';
import { useRepositories } from '../../../core/contexts/RepositoryContext';
import { openReviewCount } from '../../../core/match/review/reviewCases';
import { cssVars } from '../../../design-tokens';
import { lifecycleOf } from '../../../core/services/lifecycle';
import { useFinishTournament } from '../../../hooks/useFinishTournament';
import { useCan } from '../../auth/hooks/useCan';
import { useMatchReviews } from '../../klaerungsliste/useMatchReviews';
import { finishFacts, lateFinishHint, shouldSuggestFinish } from '../model/finishSummary';
import { useServerLifecyclePoll } from '../hooks/useServerLifecyclePoll';
import { FinishedStateSection } from './FinishedStateSection';
import { FinishSectionCards } from './FinishSectionCards';
import { FinishTournamentDialog } from './FinishTournamentDialog';

/** Abstand nach unten nur, wenn der Bereich etwas zeigt (kein leerer Rahmen im Dashboard, Review #395 M-1). */
const gap = { marginBottom: cssVars.spacing.lg } as const;

export interface FinishTournamentSectionProps {
  /** Das Turnier der Ansicht (kann mit der Spielsteuerung überlagert sein; nur zur Anzeige und für die Vorschlags-Regel). */
  tournament: Tournament;
  /** Turnier frisch neu laden (nach dem Abschluss, nach „Stand neu laden“). */
  onReload: () => Promise<void> | void;
}

export function FinishTournamentSection({ tournament, onReload }: FinishTournamentSectionProps) {
  const navigate = useNavigate();
  const { tournamentRepository } = useRepositories();
  // Ruling #394 H-1: nach dem Abschluss ist `manageLifecycle` gesperrt – dieser Bereich liest nur und bleibt offen
  const canManage = useCan('manageLifecycle', tournament.id, { openAfterClose: true });
  const { reviews } = useMatchReviews(tournament.id);
  const [open, setOpen] = useState(false);
  const [now] = useState(() => new Date());
  const lifecycle = lifecycleOf(tournament);
  const openReviews = openReviewCount(reviews);
  const loadRaw = useCallback(() => tournamentRepository.get(tournament.id, { fresh: true }), [tournamentRepository, tournament.id]);
  const reloadFresh = useCallback(async () => { await onReload(); }, [onReload]);
  const finish = useFinishTournament(tournament, { reload: reloadFresh, loadRaw });
  const facts = useMemo(() => finishFacts(tournament), [tournament]);
  const suggest = shouldSuggestFinish(tournament, lifecycle, openReviews);
  const lateHint = lateFinishHint(tournament, lifecycle, now);
  const local = tournamentRepository instanceof LocalStorageRepository;
  // Ein anderes Gerät schließt ab: die Ansicht folgt dem Server (Realtime kennt `tournaments` nicht), die Startseite lädt ebenfalls neu
  useServerLifecyclePoll(tournament.id, canManage && !local && lifecycle === 'running', () => {
    void reloadFresh().then(() => { window.dispatchEvent(new Event('tournament-updated')); });
  });
  // m-2 (Review #395): wird das Turnier abgeschlossen (oder abgebrochen), bleibt kein offener Dialog zurück – auch nicht nach dem Wiederöffnen
  // über den Notweg. Nur dieser Zustand schließt: ein kurzes Neuladen der Ansicht (Cloud-Stand wird gelesen) darf den Dialog nicht schließen.
  const ended = lifecycle === 'finished' || lifecycle === 'cancelled';
  useEffect(() => { if (ended) { setOpen(false); } }, [ended]);

  if (!canManage || local) {
    return null;
  }
  if (lifecycle === 'finished') {
    return <div style={gap}><FinishedStateSection tournament={tournament} showLate /></div>;
  }
  if (lifecycle !== 'running') {
    return null;
  }

  const closeDialog = (): void => { setOpen(false); };
  const jump = (target: string): void => { setOpen(false); void navigate(target); };
  return (
    <div style={gap}>
      <FinishSectionCards suggest={suggest} facts={facts} openReviews={openReviews} lateSince={lateHint} onOpen={() => { setOpen(true); }} />
      <FinishTournamentDialog
        isOpen={open} tournament={tournament} finish={finish} onClose={closeDialog} onJump={jump}
        onReloadState={async () => { await reloadFresh(); }}
      />
    </div>
  );
}
