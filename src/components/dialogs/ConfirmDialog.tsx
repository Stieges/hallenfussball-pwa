import { ReactNode } from 'react';
import { Dialog } from './Dialog';
import { Button } from '../ui/Button';
import { colors, fontSizes, spacing } from '../../design-tokens';
export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string | ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'warning' | 'danger';
  // Optional third button (e.g., "Verwerfen" between Cancel and Confirm)
  secondaryAction?: {
    text: string;
    onClick: () => void;
    variant?: 'secondary' | 'danger';
  };
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Bestätigen',
  cancelText = 'Abbrechen',
  variant = 'warning',
  secondaryAction,
}) => {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleSecondaryAction = () => {
    secondaryAction?.onClick();
    onClose();
  };

  const messageStyle = {
    fontSize: fontSizes.md,
    lineHeight: '1.6',
    color: colors.textPrimary,
    marginBottom: spacing.xl,
    whiteSpace: 'pre-line' as const,
  };

  const buttonContainerStyle = {
    display: 'flex',
    gap: spacing.md,
    justifyContent: 'flex-end',
    marginTop: spacing.xl,
    flexWrap: 'wrap' as const,
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="550px"
    >
      <div style={messageStyle}>
        {typeof message === 'string' ? message : message}
      </div>

      <div style={buttonContainerStyle}>
        <Button
          variant="secondary"
          size="md"
          onClick={onClose}
        >
          {cancelText}
        </Button>

        {secondaryAction && (
          <Button
            variant={secondaryAction.variant === 'danger' ? 'danger' : 'secondary'}
            size="md"
            onClick={handleSecondaryAction}
          >
            {secondaryAction.text}
          </Button>
        )}

        <Button
          variant={variant === 'danger' ? 'danger' : 'primary'}
          size="md"
          onClick={handleConfirm}
        >
          {confirmText}
        </Button>
      </div>
    </Dialog>
  );
};
