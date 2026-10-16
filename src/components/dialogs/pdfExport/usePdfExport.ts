/**
 * Ablauf des PDF-Dialogs (B-28 C8; G45, G46): Wahl → Bauen → (Hinweis vor dem Speichern) → Speichern → „PDF gespeichert“.
 * Gespeichert wird erst nach dem Bauen und, falls es Hinweise gibt, erst nach „Trotzdem speichern“ (@DR-012, @DR-013, @DR-027).
 * Der Dialog bleibt nach dem Speichern stehen, bis der Nutzer ihn schließt.
 */
import { useCallback, useState } from 'react';
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

export function usePdfExport(context: Omit<BuildContext, 'now'>, initial: PdfChoice = 'schedule') {
  const [state, setState] = useState<PdfExportState>({ choice: initial, step: 'form', busy: false, failed: false, notShared: false, pending: undefined, savedName: '' });

  const select = useCallback((choice: PdfChoice) => setState(s => ({ ...s, choice, failed: false, notShared: false })), []);
  /** Zurück zur Wahl (Abbrechen im Hinweis, Schließen nach dem Speichern). */
  const reset = useCallback(() => setState(s => ({ ...s, step: 'form', pending: undefined, failed: false, notShared: false, savedName: '' })), []);

  const save = useCallback(async () => {
    setState(s => ({ ...s, busy: true, failed: false, notShared: false }));
    try {
      const result = await buildChoice(state.choice, { ...context, now: new Date() });
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
      setState(s => ({ ...s, busy: false, failed: true }));
    }
  }, [context, state.choice]);

  /** „Trotzdem speichern“ im Hinweis-Schritt. */
  const saveAnyway = useCallback(() => {
    const { pending } = state;
    if (!pending) {
      return;
    }
    pending.doc.save(pending.filename);
    setState(s => ({ ...s, step: 'done', pending: undefined, savedName: pending.filename }));
  }, [state]);

  return { state, select, save, saveAnyway, reset };
}
