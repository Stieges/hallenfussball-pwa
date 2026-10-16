/**
 * Ablauf des PDF-Dialogs (B-28 C8; G45, G46): Wahl → Bauen → (Hinweis vor dem Speichern) → Speichern → „PDF gespeichert“.
 * Gespeichert wird erst nach dem Bauen und, falls es Hinweise gibt, erst nach „Trotzdem speichern“ (@DR-012, @DR-013, @DR-027).
 * Der Dialog bleibt nach dem Speichern stehen, bis der Nutzer ihn schließt. Jeder Lauf trägt eine Kennung: wird der Dialog
 * während des Bauens geschlossen (`reset`), gilt der Lauf nicht mehr und speichert nichts.
 */
import { useCallback, useRef, useState } from 'react';
import { hasHints } from '../../../lib/pdf/notes';
import { buildChoice, type BuildContext, type BuiltPdf, type PdfChoice } from './buildChoice';

export type PdfStep = 'form' | 'hint' | 'done';

export interface PdfExportState {
  choice: PdfChoice;
  step: PdfStep;
  busy: boolean;
  /** Das Bauen ist gescheitert; es wurde nichts gespeichert (@DR-013). */
  failed: boolean;
  /** Der Aushang braucht das Online-Teilen. */
  notShared: boolean;
  pending: BuiltPdf | undefined;
  savedName: string;
}

const START: PdfExportState = { choice: 'schedule', step: 'form', busy: false, failed: false, notShared: false, pending: undefined, savedName: '' };

export function usePdfExport(context: Omit<BuildContext, 'now'>, initial: PdfChoice = 'schedule') {
  const [state, setState] = useState<PdfExportState>({ ...START, choice: initial });
  /** Zeitpunkt des Stands: beim Öffnen und bei jedem Zurück zur Wahl neu; Dialog-Hinweis und PDF nennen denselben (G69). */
  const [now, setNow] = useState(() => new Date());
  const run = useRef(0);

  const select = useCallback((choice: PdfChoice) => setState(s => ({ ...s, choice, failed: false, notShared: false })), []);
  /** Zurück zur Wahl (Abbrechen im Hinweis, Schließen). Ein laufendes Bauen wird verworfen. */
  const reset = useCallback(() => {
    run.current += 1;
    setNow(new Date());
    setState(s => ({ ...s, step: 'form', busy: false, pending: undefined, failed: false, notShared: false, savedName: '' }));
  }, []);

  const save = useCallback(async () => {
    run.current += 1;
    const mine = run.current;
    setState(s => ({ ...s, busy: true, failed: false, notShared: false }));
    try {
      const result = await buildChoice(state.choice, { ...context, now });
      if (mine !== run.current) {
        return;
      }
      if (!result.ok) {
        setState(s => ({ ...s, busy: false, notShared: true }));
        return;
      }
      const { pdf } = result;
      if (hasHints(pdf.hints)) {
        setState(s => ({ ...s, busy: false, step: 'hint', pending: pdf }));
        return;
      }
      pdf.doc.save(pdf.filename);
      setState(s => ({ ...s, busy: false, step: 'done', pending: undefined, savedName: pdf.filename }));
    } catch (error) {
      console.error('PDF generation failed:', error);
      if (mine === run.current) {
        setState(s => ({ ...s, busy: false, failed: true }));
      }
    }
  }, [context, now, state.choice]);

  /** „Trotzdem speichern“ im Hinweis-Schritt. */
  const saveAnyway = useCallback(() => {
    const { pending } = state;
    if (!pending) {
      return;
    }
    pending.doc.save(pending.filename);
    setState(s => ({ ...s, step: 'done', pending: undefined, savedName: pending.filename }));
  }, [state]);

  return { state, now, select, save, saveAnyway, reset };
}
