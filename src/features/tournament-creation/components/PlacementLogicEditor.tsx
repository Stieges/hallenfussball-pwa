import { CSSProperties } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icons } from '../../../components/ui';
import { cssVars } from '../../../design-tokens'
import { PlacementCriterion } from '../../../types/tournament';

interface PlacementLogicEditorProps {
  placementLogic: PlacementCriterion[];
  onMove: (index: number, direction: number) => void;
  onToggle: (index: number) => void;
  onReorder?: (newOrder: PlacementCriterion[]) => void;
}

interface SortableItemProps {
  criterion: PlacementCriterion;
  index: number;
  totalItems: number;
  onMove: (index: number, direction: number) => void;
  onToggle: (index: number) => void;
}

const SortableItem: React.FC<SortableItemProps> = ({
  criterion,
  index,
  totalItems,
  onMove,
  onToggle,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: criterion.id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  const itemStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    background: isDragging
      ? cssVars.colors.secondaryLight
      : criterion.enabled
        ? cssVars.colors.primaryMedium
        : cssVars.colors.surfaceDarkMedium,
    border: isDragging
      ? `1px solid ${cssVars.colors.secondaryBorderActive}`
      : criterion.enabled
        ? `1px solid ${cssVars.colors.borderActive}`
        : '1px solid transparent',
    borderRadius: '10px',
    opacity: criterion.enabled ? 1 : 0.5,
    cursor: isDragging ? 'grabbing' : 'grab',
    touchAction: 'none',
  };

  const dragHandleStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '4px',
    cursor: 'grab',
    color: cssVars.colors.textSecondary,
  };

  const arrowButtonStyle = (disabled: boolean): CSSProperties => ({
    background: 'none',
    border: 'none',
    color: cssVars.colors.textSecondary,
    cursor: disabled ? 'not-allowed' : 'pointer',
    padding: '2px',
    opacity: disabled ? 0.3 : 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  });

  const toggleButtonStyle: CSSProperties = {
    padding: '6px 12px',
    background: criterion.enabled ? cssVars.colors.primary : cssVars.colors.border,
    border: 'none',
    borderRadius: '6px',
    color: criterion.enabled ? cssVars.colors.background : cssVars.colors.textSecondary,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div style={itemStyle} role="listitem" aria-label={`${criterion.label}, Position ${index + 1} von ${totalItems}`}>
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          style={dragHandleStyle}
          aria-label="Ziehen zum Neuordnen"
          role="button"
          tabIndex={0}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="5" cy="4" r="1.5" />
            <circle cx="11" cy="4" r="1.5" />
            <circle cx="5" cy="8" r="1.5" />
            <circle cx="11" cy="8" r="1.5" />
            <circle cx="5" cy="12" r="1.5" />
            <circle cx="11" cy="12" r="1.5" />
          </svg>
        </div>

        {/* Arrow Buttons (fallback for non-touch) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMove(index, -1);
            }}
            disabled={index === 0}
            style={arrowButtonStyle(index === 0)}
            aria-label="Nach oben verschieben"
            tabIndex={0}
          >
            <Icons.ArrowUp />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMove(index, 1);
            }}
            disabled={index === totalItems - 1}
            style={arrowButtonStyle(index === totalItems - 1)}
            aria-label="Nach unten verschieben"
            tabIndex={0}
          >
            <Icons.ArrowDown />
          </button>
        </div>

        {/* Position Number */}
        <span
          style={{
            fontFamily: cssVars.fontFamilies.heading,
            fontSize: cssVars.fontSizes.xl,
            color: cssVars.colors.primary,
            minWidth: '24px',
            textAlign: 'center',
          }}
          aria-hidden="true"
        >
          {index + 1}
        </span>

        {/* Label */}
        <span style={{ flex: 1, color: cssVars.colors.textPrimary, fontSize: cssVars.fontSizes.md }}>
          {criterion.label}
        </span>

        {/* Toggle Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle(index);
          }}
          style={toggleButtonStyle}
          aria-label={criterion.enabled ? 'Kriterium deaktivieren' : 'Kriterium aktivieren'}
          aria-pressed={criterion.enabled}
        >
          {criterion.enabled ? 'Aktiv' : 'Inaktiv'}
        </button>
      </div>
    </div>
  );
};

export const PlacementLogicEditor: React.FC<PlacementLogicEditorProps> = ({
  placementLogic,
  onMove,
  onToggle,
  onReorder,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Minimum drag distance before activation
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = placementLogic.findIndex((item) => item.id === active.id);
      const newIndex = placementLogic.findIndex((item) => item.id === over.id);

      if (onReorder) {
        const newOrder = arrayMove(placementLogic, oldIndex, newIndex);
        onReorder(newOrder);
      } else {
        // Fallback: use onMove multiple times
        const direction = newIndex > oldIndex ? 1 : -1;
        const steps = Math.abs(newIndex - oldIndex);
        for (let i = 0; i < steps; i++) {
          onMove(oldIndex + i * direction, direction);
        }
      }
    }
  };

  const containerStyle: CSSProperties = {
    marginTop: '24px',
  };

  const headerStyle: CSSProperties = {
    color: cssVars.colors.primary,
    fontSize: cssVars.fontSizes.md,
    margin: '0 0 8px 0',
  };

  const helpTextStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  };

  return (
    <div style={containerStyle}>
      <h3 style={headerStyle}>Platzierungslogik</h3>
      <p style={helpTextStyle}>
        <span>Ziehe die Kriterien per Drag & Drop oder nutze die Pfeiltasten</span>
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={placementLogic.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
            role="list"
            aria-label="Platzierungskriterien, sortierbar"
          >
            {placementLogic.map((criterion, index) => (
              <SortableItem
                key={criterion.id}
                criterion={criterion}
                index={index}
                totalItems={placementLogic.length}
                onMove={onMove}
                onToggle={onToggle}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};
