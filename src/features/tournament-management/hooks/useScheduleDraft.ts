/**
 * useScheduleDraft – „Spielplan bearbeiten“ als Entwurf (@ZP-101 bis @ZP-104).
 *
 * - Jede Änderung im Bearbeiten-Modus ist ein Schritt; nichts wird gespeichert oder übertragen bis „Speichern“ (@ZP-101).
 * - „Speichern“ prüft zuerst auf Konflikte, lässt Änderungen an inzwischen angepfiffenen Spielen aus, nennt sie und
 *   speichert den Rest als EIN Update (@ZP-102).
 * - „Abbrechen“ fragt bei Änderungen nach („n Änderungen verwerfen?“), ohne Änderungen schließt es sofort (@ZP-103).
 * - „Rückgängig“/„Wiederholen“ gehen Schritt für Schritt; ein Schritt ohne Wirkung entsteht gar nicht (@ZP-104).
 * Ersetzt usePendingChanges + useScheduleHistory (dort waren Tausch und Neuverteilen sofort gespeichert).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { generateFullSchedule, type GeneratedSchedule } from '../../../core/generators';
import type { Tournament } from '../../../types/tournament';
import { detectAllConflicts } from '../../schedule-editor/utils/scheduleConflicts';
import type { ScheduleConflict } from '../../schedule-editor/types';
import { applyDraftSteps, changedValues, type DraftResult, type DraftStep } from '../schedule-draft/draftSteps';
import { describeSkipped, matchNumberLookup } from '../schedule-draft/draftTexts';

interface UseScheduleDraftOptions {
  /** Das gespeicherte (und laufend aktualisierte) Turnier – Grundlage des Entwurfs */
  tournament: Tournament;
  /** Spielplan des gespeicherten Turniers (Anzeige ohne Änderungen) */
  schedule: GeneratedSchedule;
  onTournamentUpdate: (tournament: Tournament) => void;
  showSuccess: (message: string) => void;
  showWarning: (message: string) => void;
}

export interface ScheduleDraftControls {
  isEditing: boolean;
  startEditing: () => void;
  /** Zahl der Änderungen im Entwurf („n Änderungen nicht gespeichert“) */
  changeCount: number;
  /** Turnier mit allen Änderungen des Entwurfs (ohne Bearbeiten = gespeichertes Turnier) */
  draftTournament: Tournament;
  /** Spielplan zum Entwurf */
  draftSchedule: GeneratedSchedule;
  /** Geänderte Schiedsrichter/Felder je Spiel (Markierung an den Karten) */
  changed: ReturnType<typeof changedValues>;
  /** Neuen Schritt anhängen; `null` (keine Wirkung) ergibt keinen Schritt. `true` = angehängt. */
  addStep: (step: DraftStep | null) => boolean;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  requestCancel: () => void;
  discardOpen: boolean;
  confirmDiscard: () => void;
  keepEditing: () => void;
  save: () => void;
  saveAnyway: () => void;
  conflicts: ScheduleConflict[];
  conflictOpen: boolean;
  closeConflicts: () => void;
}

export function useScheduleDraft({ tournament, schedule, onTournamentUpdate, showSuccess, showWarning }: UseScheduleDraftOptions): ScheduleDraftControls {
  const { t } = useTranslation('tournament');
  const [isEditing, setIsEditing] = useState(false);
  const [steps, setSteps] = useState<DraftStep[]>([]);
  const [redoSteps, setRedoSteps] = useState<DraftStep[]>([]);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([]);
  const [conflictOpen, setConflictOpen] = useState(false);

  const result = useMemo<DraftResult>(() => applyDraftSteps(tournament, isEditing ? steps : []), [tournament, steps, isEditing]);
  const draftTournament = result.tournament;
  const draftSchedule = useMemo(
    () => (isEditing && steps.length > 0 ? generateFullSchedule(draftTournament) : schedule),
    [isEditing, steps.length, draftTournament, schedule],
  );
  const changed = useMemo(() => changedValues(tournament, draftTournament), [tournament, draftTournament]);

  const reset = useCallback(() => {
    setIsEditing(false);
    setSteps([]);
    setRedoSteps([]);
    setDiscardOpen(false);
    setConflictOpen(false);
    setConflicts([]);
  }, []);

  const startEditing = useCallback(() => { reset(); setIsEditing(true); }, [reset]);

  const addStep = useCallback((step: DraftStep | null): boolean => {
    if (!step) { return false; }
    setSteps((prev) => [...prev, step]);
    setRedoSteps([]);
    return true;
  }, []);

  const undo = useCallback(() => {
    if (steps.length === 0) { return; }
    setRedoSteps((r) => [...r, steps[steps.length - 1]]);
    setSteps(steps.slice(0, -1));
  }, [steps]);

  const redo = useCallback(() => {
    if (redoSteps.length === 0) { return; }
    setSteps((s) => [...s, redoSteps[redoSteps.length - 1]]);
    setRedoSteps(redoSteps.slice(0, -1));
  }, [redoSteps]);

  const requestCancel = useCallback(() => {
    if (steps.length === 0) { reset(); return; }
    setDiscardOpen(true);
  }, [steps.length, reset]);

  // Speichern: der Entwurf wird zum Zeitpunkt des Speicherns neu auf das aktuelle Turnier angewendet (@ZP-102)
  const commit = useCallback(() => {
    const final = applyDraftSteps(tournament, steps);
    if (final.appliedSteps > 0) {
      onTournamentUpdate({ ...final.tournament, updatedAt: new Date().toISOString() });
      showSuccess(t('actions.changesSaved'));
    }
    if (final.skipped.length > 0) {
      const list = describeSkipped(final.skipped, matchNumberLookup(tournament.matches), t);
      showWarning(t('draft.notApplied', { list }));
    }
    reset();
  }, [tournament, steps, onTournamentUpdate, showSuccess, showWarning, t, reset]);

  const save = useCallback(() => {
    const final = applyDraftSteps(tournament, steps);
    const found = final.appliedSteps > 0
      ? detectAllConflicts(final.tournament.matches, tournament.teams, {
        matchDurationMinutes: tournament.groupPhaseGameDuration,
        minBreakMinutes: tournament.groupPhaseBreakDuration ?? 0,
        checkRefereeConflicts: tournament.refereeConfig?.mode !== 'none',
        checkFieldConflicts: tournament.numberOfFields > 1,
      })
      : [];
    if (found.length > 0) {
      setConflicts(found);
      setConflictOpen(true);
      return;
    }
    commit();
  }, [tournament, steps, commit]);

  // Tastenkürzel nur im Bearbeiten-Modus: Strg/Cmd+Z, Strg+Y bzw. Cmd+Umschalt+Z
  useEffect(() => {
    if (!isEditing) { return; }
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) { return; }
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isEditing, undo, redo]);

  return {
    isEditing,
    startEditing,
    changeCount: isEditing ? steps.length : 0,
    draftTournament,
    draftSchedule,
    changed,
    addStep,
    canUndo: isEditing && steps.length > 0,
    canRedo: isEditing && redoSteps.length > 0,
    undo,
    redo,
    requestCancel,
    discardOpen,
    confirmDiscard: reset,
    keepEditing: useCallback(() => setDiscardOpen(false), []),
    save,
    saveAnyway: commit,
    conflicts,
    conflictOpen,
    closeConflicts: useCallback(() => setConflictOpen(false), []),
  };
}
