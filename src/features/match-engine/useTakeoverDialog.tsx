/**
 * useTakeoverDialog (B-49): Zustand der Rückfrage „Spielleitung übernehmen?“ – geteilt von Cockpit und Spielplan.
 *
 * `open` zeigt den Dialog für ein Feld mit der zuletzt gesehenen Epoche; „Spielleitung übernehmen“ ruft `takeOver`.
 * Gelingt es, schließt der Dialog und `onTaken` läuft (Cockpit: Hinweis „Uhr prüfen“, @SL-015; Spielplan: ins Cockpit, @FU-081).
 * Scheitert es, bleibt er offen mit dem Grund: ohne Netz „Übernehmen geht nur mit Netz“ (@FU-028, das andere Gerät steuert
 * weiter), inzwischen übernommen „Feld 2 wird jetzt von Maria gesteuert“ (neue Epoche, ein zweiter Tipp versucht es erneut).
 */
import { useCallback, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { TakeoverDialog } from '../../components/dialogs/TakeoverDialog';
import type { TakeFieldControlResult } from '../../core/repositories/fieldControlRpc';
import { fieldHolderText } from './fieldHolderText';
import type { FieldControl } from './useFieldControl';

export type TakeoverSuccess = Extract<TakeFieldControlResult, { kind: 'taken' | 'unchanged' }>;

export interface TakeoverRequest {
  field: number;
  /** Anzeigename, z. B. „Feld 2“. */
  feldName: string;
  /** Zuletzt gesehene Epoche des Feldes. */
  epoch: number;
  /** Halter, z. B. „Tom (Handy)“; `null` ohne Namen. */
  halter: string | null;
  onTaken?: (result: TakeoverSuccess) => void;
}

export interface TakeoverDialogState {
  open: (request: TakeoverRequest) => void;
  /** Der Dialog (oder `null`), vom Aufrufer zu rendern. */
  dialog: ReactNode;
}

export function useTakeoverDialog(takeOver: FieldControl['takeOver']): TakeoverDialogState {
  const { t } = useTranslation('cockpit');
  const [request, setRequest] = useState<TakeoverRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  // R3-2a (Plan H-9): nach dem Abschluss lehnt der Server jede Übernahme ab – die Haupttaste bleibt dann gesperrt
  const [abgeschlossen, setAbgeschlossen] = useState(false);

  const open = useCallback((next: TakeoverRequest) => {
    setRequest(next);
    setFehler(null);
    setAbgeschlossen(false);
  }, []);
  const close = useCallback(() => {
    setRequest(null);
    setFehler(null);
    setAbgeschlossen(false);
  }, []);

  const confirm = useCallback(async () => {
    if (!request || busy || abgeschlossen) {
      return;
    }
    setBusy(true);
    const result = await takeOver(request.field, request.epoch);
    setBusy(false);
    if (result.kind === 'taken' || result.kind === 'unchanged') {
      close();
      request.onTaken?.(result);
      return;
    }
    if (result.kind === 'changed') {
      const name = result.control ? fieldHolderText(result.control) : null;
      setRequest({ ...request, epoch: result.control?.epoch ?? request.epoch, halter: name ?? request.halter });
      setFehler(name !== null
        ? t('steuer.inzwischen', { feld: request.feldName, name })
        : t('steuer.inzwischenOhneName', { feld: request.feldName }));
      return;
    }
    if (result.kind === 'tournamentFinished') {
      setAbgeschlossen(true);
      setFehler(t('steuer.turnierAbgeschlossen'));
      return;
    }
    setFehler(t(result.kind === 'offline' ? 'steuer.nurMitNetz' : result.kind === 'forbidden' ? 'steuer.keinRecht' : 'steuer.fehler'));
  }, [request, busy, abgeschlossen, takeOver, close, t]);

  const dialog = request ? (
    <TakeoverDialog
      isOpen
      feldName={request.feldName}
      halter={request.halter}
      busy={busy || abgeschlossen}
      fehler={fehler}
      onConfirm={() => { void confirm(); }}
      onCancel={close}
    />
  ) : null;

  return { open, dialog };
}
