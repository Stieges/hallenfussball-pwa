/**
 * Verbindung der Ansichten (Tabellen, Spielplan) mit dem Ablauf „Gruppe abschließen“ (GA4 A-13c). Ohne Anbieter
 * (Zuschauer, Monitor, Vorschau) gibt es weder Zustandsmarken noch Tasten – `useGroupCompletionUi()` liefert dann `null`.
 */
import { createContext, useContext } from 'react';
import type { GroupCompletionApi } from './useGroupCompletion';

export const GroupCompletionContext = createContext<GroupCompletionApi | null>(null);

export const useGroupCompletionUi = (): GroupCompletionApi | null => useContext(GroupCompletionContext);
