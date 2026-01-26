/**
 * useAutoSave Hook
 *
 * Provides auto-save functionality for tournament creation wizard.
 * - Periodic auto-save every 10 seconds
 * - Save on tab close / page refresh
 * - Save confirmation notification
 */

import { useState, useCallback, useEffect, MutableRefObject } from 'react';
import { Tournament } from '../types/tournament';

export interface UseAutoSaveOptions {
  /** Form data to check for changes */
  formData: Partial<Tournament>;
  /** Reference to last saved data JSON string */
  lastSavedDataRef: MutableRefObject<string>;
  /** Function to save the tournament */
  saveTournament: (tournament: Tournament) => void | Promise<void>;
  /** Function to create a draft tournament from form data */
  createDraftTournament: () => Tournament;
  /** Interval in ms for periodic auto-save (default: 10000) */
  autoSaveInterval?: number;
}

export interface UseAutoSaveReturn {
  /** Whether there are unsaved changes */
  hasUnsavedChanges: () => boolean;
  /** Save as draft immediately */
  saveAsDraft: () => void;
  /** Show save notification state */
  showSaveNotification: boolean;
  /** Show save confirmation */
  showSaveConfirmation: () => void;
}

export function useAutoSave({
  formData,
  lastSavedDataRef,
  saveTournament,
  createDraftTournament,
  autoSaveInterval = 10000,
}: UseAutoSaveOptions): UseAutoSaveReturn {
  const [showSaveNotification, setShowSaveNotification] = useState(false);

  // Check if data has changed
  const hasUnsavedChanges = useCallback((): boolean => {
    /* eslint-disable @typescript-eslint/prefer-nullish-coalescing -- Boolean OR: true if any field has data */
    const hasData =
      formData.title ||
      formData.location ||
      (formData.teams && formData.teams.length > 0);
    /* eslint-enable @typescript-eslint/prefer-nullish-coalescing */

    if (!hasData) {return false;}

    // Check if data is different from last save
    const currentData = JSON.stringify(formData);
    return currentData !== lastSavedDataRef.current;
  }, [formData, lastSavedDataRef]);

  // Show save confirmation notification
  const showSaveConfirmation = useCallback(() => {
    setShowSaveNotification(true);
    setTimeout(() => setShowSaveNotification(false), 2000);
  }, []);

  // Save as draft
  const saveAsDraft = useCallback(() => {
    if (!hasUnsavedChanges()) {return;}

    const tournament = createDraftTournament();

    try {
      void saveTournament(tournament);
      lastSavedDataRef.current = JSON.stringify(formData);
      showSaveConfirmation();
    } catch {
      // Error handling is silent - could be enhanced with error callback
    }
  }, [hasUnsavedChanges, formData, saveTournament, showSaveConfirmation, createDraftTournament, lastSavedDataRef]);

  // Periodic auto-save effect
  useEffect(() => {
    const interval = setInterval(() => {
      if (hasUnsavedChanges()) {
        saveAsDraft();
      }
    }, autoSaveInterval);

    return () => clearInterval(interval);
  }, [hasUnsavedChanges, saveAsDraft, autoSaveInterval]);

  // Save on tab close / page refresh
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasUnsavedChanges()) {
        saveAsDraft();
        event.preventDefault();
        // eslint-disable-next-line @typescript-eslint/no-deprecated -- Required for cross-browser compatibility
        event.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges, saveAsDraft]);

  return {
    hasUnsavedChanges,
    saveAsDraft,
    showSaveNotification,
    showSaveConfirmation,
  };
}
