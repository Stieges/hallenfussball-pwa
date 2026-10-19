/**
 * FinalSortableRow - Tabellenzeile der Finalrunde mit Verschieben per Drag & Drop (US-SCHEDULE-EDITOR).
 *
 * Steht bewusst auf Modulebene (C-SCHNELLEINGABE-ENTWURF-VERLOREN, @FU-101): als Komponente innerhalb von
 * `FinalStageSchedule` war sie bei jedem Rendern ein neuer Typ, React baute jede Zeile samt Schnelleingabe neu auf, und
 * ein angefangener Eintrag ging beim Nachladen, bei Realtime-Updates anderer Spiele und im Sekundentakt der Uhr verloren.
 * Der Griff zum Ziehen bekommt die Listener über `children`, nicht die ganze Zeile.
 */
import type { CSSProperties, ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cssVars, shadowSemantics } from '../../design-tokens';

export interface FinalSortableRowRenderProps {
  attributes: ReturnType<typeof useSortable>['attributes'];
  listeners: ReturnType<typeof useSortable>['listeners'];
  canDrag: boolean;
  isDragging: boolean;
}

interface FinalSortableRowProps {
  matchId: string;
  isRunning: boolean;
  isFinished: boolean;
  editingSchedule: boolean;
  /** Tauschen ist angeschlossen (`onMatchSwap`) */
  canSwap: boolean;
  children: (props: FinalSortableRowRenderProps) => ReactNode;
}

const OUTLINE_INSET = `calc(-1 * ${cssVars.borderWidth.thin})`;
const DROP_TARGET_WIDTH = `calc(${cssVars.borderWidth.thin} + ${cssVars.borderWidth.medium})`;

export const FinalSortableRow: React.FC<FinalSortableRowProps> = ({ matchId, isRunning, isFinished, editingSchedule, canSwap, children }) => {
  const canDrag = editingSchedule && canSwap && !isRunning && !isFinished;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: matchId,
    disabled: !canDrag,
  });

  // Apply transform and transition for smooth animations
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isRunning ? { backgroundColor: cssVars.colors.statusLiveRowBg } : {}),
    ...(editingSchedule && canDrag ? {
      outline: `${cssVars.borderWidth.medium} solid ${cssVars.colors.accent}`,
      outlineOffset: OUTLINE_INSET,
    } : {}),
    // When THIS row is being dragged: show as placeholder
    ...(isDragging ? {
      opacity: 0.4,
      backgroundColor: cssVars.colors.editorSwapBg,
      outline: `${cssVars.borderWidth.medium} dashed ${cssVars.colors.accent}`,
      outlineOffset: OUTLINE_INSET,
      zIndex: 0,
    } : {}),
    // When another row is dragged OVER this one: highlight as drop target
    ...(isOver && !isDragging ? {
      backgroundColor: cssVars.colors.editorSwapActive,
      outline: `${DROP_TARGET_WIDTH} solid ${cssVars.colors.accent}`,
      outlineOffset: OUTLINE_INSET,
      boxShadow: shadowSemantics.dropTargetGlow,
    } : {}),
  };

  return (
    <tr ref={setNodeRef} style={style}>
      {children({ attributes, listeners, canDrag, isDragging })}
    </tr>
  );
};
