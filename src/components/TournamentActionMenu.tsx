/**
 * TournamentActionMenu Component
 *
 * Responsive action menu for tournaments:
 * - Desktop: Dropdown menu with ActionMenu
 * - Mobile: BottomSheet with action list
 *
 * Available actions depend on tournament status:
 * - Running: Open, Share (no delete)
 * - Upcoming/Draft: Open, Share, Delete
 * - Finished: Open, Share, Archive, Delete
 * - Trashed: Restore, Permanent Delete
 */

import { useState, CSSProperties } from 'react';
import { Tournament } from '../types/tournament';
import { ActionMenu, ActionMenuItem } from './ui/ActionMenu';
import { BottomSheet, BottomSheetItem } from './ui/BottomSheet';
import { Icons } from './ui/Icons';
import { useIsMobile } from '../hooks/useIsMobile';
import { cssVars } from '../design-tokens'

export type TournamentAction = 'open' | 'copy' | 'share' | 'delete' | 'restore' | 'permanentDelete';

interface TournamentActionMenuProps {
  tournament: Tournament;
  /** Which category the tournament belongs to */
  category: 'running' | 'upcoming' | 'finished' | 'draft' | 'trashed';
  /** Callbacks for each action */
  onOpen?: () => void;
  onCopy?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
  onRestore?: () => void;
  onPermanentDelete?: () => void;
  /** Test ID for E2E tests */
  testId?: string;
}

export const TournamentActionMenu: React.FC<TournamentActionMenuProps> = ({
  tournament,
  category,
  onOpen,
  onCopy,
  onShare,
  onDelete,
  onRestore,
  onPermanentDelete,
  testId,
}) => {
  const isMobile = useIsMobile();
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);

  // Build action items based on category
  const getActionItems = (): ActionMenuItem[] => {
    const items: ActionMenuItem[] = [];

    // "Open" action - available for all except trashed
    if (category !== 'trashed' && onOpen) {
      items.push({
        id: 'open',
        label: 'Öffnen',
        icon: <Icons.ExternalLink size={18} />,
        onClick: onOpen,
      });
    }

    // "Copy" action - available for all except trashed
    if (category !== 'trashed' && onCopy) {
      items.push({
        id: 'copy',
        label: 'Kopieren',
        icon: <Icons.Copy size={18} />,
        onClick: onCopy,
      });
    }

    // "Share" action - available for all except trashed
    if (category !== 'trashed' && onShare) {
      items.push({
        id: 'share',
        label: 'Teilen',
        icon: <Icons.Share size={18} />,
        onClick: onShare,
      });
    }

    // "Delete" action - available for upcoming, finished, draft
    if (category !== 'running' && category !== 'trashed' && onDelete) {
      items.push({
        id: 'delete',
        label: 'Löschen',
        icon: <Icons.Trash size={18} />,
        onClick: onDelete,
        variant: 'danger',
      });
    }

    // "Restore" action - only for trashed
    if (category === 'trashed' && onRestore) {
      items.push({
        id: 'restore',
        label: 'Wiederherstellen',
        icon: <Icons.Restore size={18} />,
        onClick: onRestore,
      });
    }

    // "Permanent Delete" action - only for trashed
    if (category === 'trashed' && onPermanentDelete) {
      items.push({
        id: 'permanentDelete',
        label: 'Endgültig löschen',
        icon: <Icons.Trash size={18} />,
        onClick: onPermanentDelete,
        variant: 'danger',
      });
    }

    return items;
  };

  const actionItems = getActionItems();

  // Don't render if no actions available
  if (actionItems.length === 0) {
    return null;
  }

  // Mobile: Trigger button + BottomSheet
  if (isMobile) {
    const triggerStyle: CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '44px',
      height: '44px',
      border: 'none',
      background: 'transparent',
      borderRadius: cssVars.borderRadius.md,
      cursor: 'pointer',
      color: cssVars.colors.textSecondary,
      transition: 'all 0.2s ease',
    };

    const handleTriggerClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsBottomSheetOpen(true);
    };

    const handleActionClick = (action: ActionMenuItem) => {
      setIsBottomSheetOpen(false);
      action.onClick();
    };

    return (
      <>
        <button
          style={triggerStyle}
          onClick={handleTriggerClick}
          aria-label="Aktionen"
          data-testid={testId ? `${testId}-trigger` : undefined}
        >
          <Icons.MoreVertical size={20} />
        </button>

        <BottomSheet
          isOpen={isBottomSheetOpen}
          onClose={() => setIsBottomSheetOpen(false)}
          title={tournament.title}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: cssVars.spacing.xs }}>
            {actionItems.map((item) => (
              <BottomSheetItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                onClick={() => handleActionClick(item)}
                data-testid={`action-menu-item-${item.id}`}
              />
            ))}
          </div>
        </BottomSheet>
      </>
    );
  }

  // Desktop: ActionMenu dropdown
  return (
    <ActionMenu
      items={actionItems}
      testId={testId}
    />
  );
};
