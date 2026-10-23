/**
 * Kopfbereich von „Tabellen“ und „Spielplan“ (GA4 A-13c): Zustand der Gruppenphase und der Finalrunde (@TM-059) und darunter der
 * Vorschlag „Gruppe abschließen“ bzw. „Besetzung prüfen“ für die Turnierleitung. Ohne Anbieter (Zuschauer, Vorschau) und ohne
 * etwas zu zeigen rendert der Baustein nichts. Einbau nur per Import in `TabellenTab` und `ScheduleTab`, nicht im Verwaltungskopf.
 */
import type { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens';
import { GroupCompletionBanner } from './GroupCompletionBanner';
import { PhaseMarks } from './GroupStateHead';
import { useGroupCompletionUi } from './groupCompletionContext';

const top: CSSProperties = { display: 'grid', gap: cssVars.spacing.md, marginBottom: cssVars.spacing.md };

export const GroupCompletionTop = () => {
  const api = useGroupCompletionUi();
  if (api === null) {
    return null;
  }
  return (
    <div style={top} data-testid="group-completion-top">
      <PhaseMarks />
      <GroupCompletionBanner />
    </div>
  );
};
