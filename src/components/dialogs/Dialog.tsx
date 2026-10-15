import { ReactNode, CSSProperties, useId, type RefObject } from 'react';
import { cssVars, dialogWidths, mediaQueries } from '../../design-tokens';
import { Icons } from '../ui/Icons';
import { DialogSurface } from '../ui/molecules/DialogSurface';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
  closeOnBackdropClick?: boolean;
  /** Start-Ziel des Fokus (@OB-014: bei Rückfragen zuerst „Abbrechen") */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** @OB-014: Enter löst in gefährlichen Rückfragen nichts aus */
  suppressEnter?: boolean;
}

export const Dialog = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = dialogWidths.md,
  closeOnBackdropClick = true,
  initialFocusRef,
  suppressEnter,
}: DialogProps) => {
  // Stable unique ID for aria-labelledby (React 18+)
  const titleId = useId();

  const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: cssVars.spacing.xl,
    borderBottom: `1px solid ${cssVars.colors.border}`,
  };

  const titleStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xl,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
    margin: 0,
  };

  const closeButtonStyle: CSSProperties = {
    width: '44px',
    height: '44px',
    minWidth: '44px',
    minHeight: '44px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: cssVars.borderRadius.sm,
    transition: 'background-color 0.2s',
    color: cssVars.colors.textSecondary,
  };

  const contentStyle: CSSProperties = {
    padding: cssVars.spacing.xl,
  };

  return (
    <DialogSurface
      isOpen={isOpen}
      onClose={onClose}
      labelledBy={titleId}
      maxWidth={maxWidth}
      closeOnBackdropClick={closeOnBackdropClick}
      initialFocusRef={initialFocusRef}
      suppressEnter={suppressEnter}
      panelClassName="dialog-modal"
    >
      <div style={headerStyle} className="dialog-header">
        <h2 id={titleId} style={titleStyle}>{title}</h2>
        <button
          style={closeButtonStyle}
          onClick={onClose}
          aria-label="Schließen"
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = cssVars.colors.surfaceHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <Icons.X size={20} />
        </button>
      </div>
      <div style={contentStyle} className="dialog-content">{children}</div>

      <style>{`
        ${mediaQueries.tabletDown} {
          .dialog-modal .dialog-header,
          .dialog-modal .dialog-content {
            padding: ${cssVars.spacing.md} !important;
          }
        }
      `}</style>
    </DialogSurface>
  );
};
