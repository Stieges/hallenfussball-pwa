import { ReactNode } from 'react';
import { Dialog } from './Dialog';
import { Button } from '../ui/Button';
import { theme } from '../../styles/theme';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string | ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'warning' | 'danger';
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
}) => {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const messageStyle = {
    fontSize: theme.fontSizes.md,
    lineHeight: '1.6',
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xl,
    whiteSpace: 'pre-line' as const,
  };

  const buttonContainerStyle = {
    display: 'flex',
    gap: theme.spacing.md,
    justifyContent: 'flex-end',
    marginTop: theme.spacing.xl,
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
