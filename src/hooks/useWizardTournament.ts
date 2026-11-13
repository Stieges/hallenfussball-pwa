/**
 * @W5-039 (Befund C-ENTWURF-WIEDEROEFFNEN-LOESCHT-TEAMS): welches Turnier der Assistent zum Bearbeiten bekommt.
 *
 * Der Assistent startet bei `/tournament/:id/edit` nur mit dem VOLLSTÄNDIG geladenen Turnier (Teams, Spiele, Einstellungen).
 * Der Listen-Eintrag der Startseite (Kopfdaten ohne Teams und Spiele) geht nie an ihn: der Assistent hätte ihn als Stand
 * übernommen und nach 10 Sekunden als ganzes Turnier gespeichert, was am Server alle Teams und nicht angepfiffenen Spiele löscht.
 *
 * Quellen, in dieser Reihenfolge:
 * 1. das Turnier aus „Turnier bearbeiten“ der Verwaltung (`selected`, geladen und gespeichert) mit derselben Kennung;
 * 2. sonst `repository.get(id, { fresh: true })` – wartet auf den Cloud-Stand und führt ihn mit der lokalen Kopie zusammen
 *    (wie die Verwaltung beim Neuladen), damit eine veraltete lokale Kopie ohne wartende Änderung nicht den Server überschreibt.
 *    Ohne Netz liefert `get` die lokale Kopie; fehlt sie, scheitert das Laden.
 * Bis dahin: `loading`, bei Scheitern `failed` – in beiden Fällen gibt es kein Turnier und der Assistent läuft nicht.
 * Ein einmal geladenes Turnier bleibt für diese Kennung stehen (kein Neuladen beim Speichern, der Assistent bleibt gemountet).
 */
import { useEffect, useState } from 'react';
import type { Tournament } from '../types/tournament';
import { isListEntryOnly } from '../core/repositories/listEntryGuard';
import { useRepository } from './useRepository';

export type WizardTournamentLoad =
  | { status: 'ready'; tournament: Tournament | undefined }
  | { status: 'loading' }
  | { status: 'failed' };

interface Held { id: string; tournament: Tournament }

export function useWizardTournament(editingId: string | null, selected: Tournament | null): WizardTournamentLoad {
  const repository = useRepository();
  const [held, setHeld] = useState<Held | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);

  const direct = editingId !== null && selected?.id === editingId && !isListEntryOnly(selected) ? selected : null;
  if (direct !== null && held?.tournament !== direct) {
    setHeld({ id: direct.id, tournament: direct });
  }
  const heldId = held?.id ?? null;
  const hasDirect = direct !== null;

  useEffect(() => {
    if (editingId === null || hasDirect || heldId === editingId) { return; }
    let cancelled = false;
    setFailedId(null);
    repository.get(editingId, { fresh: true }).then(
      (loaded) => {
        if (cancelled) { return; }
        if (loaded === null || isListEntryOnly(loaded)) { setFailedId(editingId); return; }
        setHeld({ id: editingId, tournament: loaded });
      },
      () => { if (!cancelled) { setFailedId(editingId); } },
    );
    return () => { cancelled = true; };
  }, [editingId, hasDirect, heldId, repository]);

  if (editingId === null) {
    return { status: 'ready', tournament: selected !== null && !isListEntryOnly(selected) ? selected : undefined };
  }
  if (direct !== null) { return { status: 'ready', tournament: direct }; }
  if (held?.id === editingId) { return { status: 'ready', tournament: held.tournament }; }
  return failedId === editingId ? { status: 'failed' } : { status: 'loading' };
}
