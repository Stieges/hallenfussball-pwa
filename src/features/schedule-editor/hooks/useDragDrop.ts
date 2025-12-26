/**
 * US-SCHEDULE-EDITOR: useDragDrop Hook
 *
 * Manages drag and drop operations for the schedule editor.
 * Uses @dnd-kit for smooth, accessible DnD.
 */

import { useState, useCallback } from 'react';
import {
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  DragStartEvent,
  DragEndEvent,
  DragCancelEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { TimeSlot } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface UseDragDropOptions {
  /** Whether drag and drop is enabled */
  enabled?: boolean;
  /** Callback when a match is moved to a new slot */
  onMoveMatch: (matchId: string, targetSlot: TimeSlot) => void;
  /** Validate if a drop is allowed */
  validateDrop?: (matchId: string, targetSlot: TimeSlot) => boolean;
}

export interface UseDragDropReturn {
  /** DnD sensors for the DndContext */
  sensors: ReturnType<typeof useSensors>;
  /** Currently dragged match ID */
  activeId: string | null;
  /** Current drop target slot ID */
  overId: string | null;
  /** Whether a drag is in progress */
  isDragging: boolean;
  /** Handle drag start */
  handleDragStart: (event: DragStartEvent) => void;
  /** Handle drag end */
  handleDragEnd: (event: DragEndEvent) => void;
  /** Handle drag cancel */
  handleDragCancel: (event: DragCancelEvent) => void;
}

// ============================================================================
// Slot ID Utilities
// ============================================================================

/**
 * Create a slot ID from time and field
 */
export function createSlotId(time: string, fieldId: number): string {
  return `slot-${time}-${fieldId}`;
}

/**
 * Parse a slot ID into time and field
 */
export function parseSlotId(slotId: string): { time: string; fieldId: number } | null {
  const match = slotId.match(/^slot-(.+)-(\d+)$/);
  if (!match) return null;
  return {
    time: match[1],
    fieldId: parseInt(match[2], 10),
  };
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useDragDrop(options: UseDragDropOptions): UseDragDropReturn {
  const { enabled = true, onMoveMatch, validateDrop } = options;

  // State
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Configure sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Require the pointer to move 8px before starting a drag
      // This prevents accidental drags on click
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    if (!enabled) return;
    const { active } = event;
    setActiveId(active.id as string);
  }, [enabled]);

  // Handle drag end
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    setActiveId(null);
    setOverId(null);

    if (!over || !active) return;
    if (active.id === over.id) return;

    const matchId = active.id as string;
    const slotId = over.id as string;

    // Parse the target slot
    const parsed = parseSlotId(slotId);
    if (!parsed) {
      console.warn('Invalid slot ID:', slotId);
      return;
    }

    // Create TimeSlot object
    const targetSlot: TimeSlot = {
      id: slotId,
      startTime: parsed.time,
      fieldId: parsed.fieldId,
      matchId: null, // Will be filled after move
      isDropTarget: true,
    };

    // Validate if drop is allowed
    if (validateDrop && !validateDrop(matchId, targetSlot)) {
      console.log('Drop not allowed:', matchId, targetSlot);
      return;
    }

    // Execute the move
    onMoveMatch(matchId, targetSlot);
  }, [onMoveMatch, validateDrop]);

  // Handle drag cancel
  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOverId(null);
  }, []);

  return {
    sensors,
    activeId,
    overId,
    isDragging: activeId !== null,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  };
}

export default useDragDrop;
