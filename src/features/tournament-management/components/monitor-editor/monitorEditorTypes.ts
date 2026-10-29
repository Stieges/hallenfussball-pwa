/**
 * Gebündelte Props des Monitor-Editors (H2): `slideContext` = was Folien anzeigen, `slideActions` = was sie auslösen.
 */

import type { Tournament, TournamentField, TournamentGroup } from '../../../../types/tournament';
import type { SlotTargets } from '../../../../core/services/monitorConfigTransferChecks';
import type { SlideUpdate } from './monitorDraft';

export interface SlideContext {
  tournament: Tournament;
  fields: TournamentField[];
  groups: TournamentGroup[];
  sponsors: { id: string; name: string }[];
  slotTargets: SlotTargets;
  getFieldDisplayName: (id: string) => string;
}

export interface SlideActions {
  onMoveSlide: (slideId: string, direction: 'up' | 'down') => void;
  onRemoveSlide: (slideId: string) => void;
  onUpdateSlide: (slideId: string, updates: SlideUpdate) => void;
  onToggleEditSlide: (slideId: string) => void;
}
