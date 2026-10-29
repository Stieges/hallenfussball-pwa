/**
 * Entwurf des Monitor-Editors (@ME-071, @ME-072): Änderungen gelten erst mit `save()`.
 * Der Entwurf wird einmal beim Öffnen aus dem gespeicherten Monitor gefüllt.
 */

import { useCallback, useRef, useState } from 'react';
import type { MonitorSlide, SlideConfig, SlideType, TournamentMonitor } from '../../../types/monitor';
import {
  addSlideToDraft,
  isDraftDirty,
  moveSlideInDraft,
  removeSlideFromDraft,
  updateSettingsInDraft,
  updateSlideInDraft,
  type MonitorSettingsUpdate,
  type SlideUpdate,
} from '../components/monitor-editor/monitorDraft';
import { validateMonitorName, type MonitorNameError } from '../components/monitor-editor/validateMonitorName';

export type MonitorSaveResult = 'saved' | 'unchanged' | 'invalid' | 'failed' | 'busy';

export interface UseMonitorEditorDraftResult {
  draft: TournamentMonitor;
  isDirty: boolean;
  isSaving: boolean;
  nameError: MonitorNameError | null;
  saveError: string | null;
  addSlide: (type: SlideType, config?: Partial<SlideConfig>) => MonitorSlide;
  updateSlide: (slideId: string, updates: SlideUpdate) => void;
  removeSlide: (slideId: string) => void;
  moveSlide: (slideId: string, direction: 'up' | 'down') => void;
  updateSettings: (updates: MonitorSettingsUpdate) => void;
  save: () => Promise<MonitorSaveResult>;
}

/**
 * @param stored - der gespeicherte Monitor (Vergleichsbasis; Entwurf wird nur beim Öffnen daraus gefüllt)
 * @param otherNames - Namen der anderen Monitore des Turniers
 * @param saveMonitor - speichert den ganzen Monitor (useMonitors.saveMonitor)
 */
export function useMonitorEditorDraft(
  stored: TournamentMonitor,
  otherNames: readonly string[],
  saveMonitor: (monitor: TournamentMonitor) => Promise<TournamentMonitor>
): UseMonitorEditorDraftResult {
  const [draft, setDraft] = useState<TournamentMonitor>(stored);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [nameChecked, setNameChecked] = useState(false);
  // Sperre gilt sofort, auch bevor React neu gerendert hat
  const savingRef = useRef(false);

  const isDirty = isDraftDirty(stored, draft);
  const rawNameError = validateMonitorName(draft.name, otherNames);
  const nameError = nameChecked ? rawNameError : null;

  const draftRef = useRef(draft);

  const change = useCallback((fn: (d: TournamentMonitor) => TournamentMonitor) => {
    draftRef.current = fn(draftRef.current);
    setDraft(draftRef.current);
  }, []);

  const addSlide = useCallback((type: SlideType, config?: Partial<SlideConfig>): MonitorSlide => {
    const result = addSlideToDraft(draftRef.current, type, config);
    change(() => result.draft);
    return result.slide;
  }, [change]);

  const save = useCallback(async (): Promise<MonitorSaveResult> => {
    if (savingRef.current) {
      return 'busy';
    }
    setNameChecked(true);
    if (validateMonitorName(draftRef.current.name, otherNames) !== null) {
      return 'invalid';
    }
    if (!isDraftDirty(stored, draftRef.current)) {
      return 'unchanged';
    }
    savingRef.current = true;
    setIsSaving(true);
    setSaveError(null);
    try {
      await saveMonitor(draftRef.current);
      return 'saved';
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'saveFailed');
      return 'failed';
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }, [stored, otherNames, saveMonitor]);

  return {
    draft,
    isDirty,
    isSaving,
    nameError,
    saveError,
    addSlide,
    updateSlide: useCallback((id, u) => change(d => updateSlideInDraft(d, id, u)), [change]),
    removeSlide: useCallback(id => change(d => removeSlideFromDraft(d, id)), [change]),
    moveSlide: useCallback((id, dir) => change(d => moveSlideInDraft(d, id, dir)), [change]),
    updateSettings: useCallback(u => change(d => updateSettingsInDraft(d, u)), [change]),
    save,
  };
}
