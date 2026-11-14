/**
 * Formular „Neuen Monitor anlegen“ (aus MonitorsConfigTab ausgelagert): Name mit sichtbarem Label, Enter legt an,
 * Esc bricht ab. Haupttaste 56 px, Eingabe 16 px (Größen am Handy).
 */

import { useEffect, useRef } from 'react';
import type { CSSProperties, SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';

interface MonitorCreateFormProps {
  name: string;
  isLoading: boolean;
  onNameChange: (name: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

const formStyle: CSSProperties = {
  padding: cssVars.spacing.lg,
  background: cssVars.colors.surface,
  borderRadius: cssVars.borderRadius.lg,
  border: `1px solid ${cssVars.colors.primary}`,
  marginBottom: cssVars.spacing.lg,
  display: 'flex',
  flexDirection: 'column',
  gap: cssVars.spacing.md,
};

const actionsStyle: CSSProperties = {
  display: 'flex',
  gap: cssVars.spacing.sm,
  justifyContent: 'flex-end',
  flexWrap: 'wrap',
};

export function MonitorCreateForm({ name, isLoading, onNameChange, onCancel, onSubmit }: MonitorCreateFormProps) {
  const { t } = useTranslation('tournament');
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.querySelector('input')?.focus();
  }, []);

  const handleSubmit = (event: SyntheticEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form
      ref={formRef}
      style={formStyle}
      onSubmit={handleSubmit}
      onKeyDown={(e) => { if (e.key === 'Escape') {onCancel();} }}
      data-testid="monitor-create-form"
    >
      <h3 style={{ margin: 0, color: cssVars.colors.textPrimary }}>{t('monitors.createTitle')}</h3>
      <Input
        label={t('monitors.nameLabel')}
        placeholder={t('monitors.namePlaceholder')}
        value={name}
        onChange={onNameChange}
        data-testid="monitor-create-name"
      />
      <div style={actionsStyle}>
        <Button variant="secondary" onClick={onCancel} data-testid="monitor-create-cancel">
          {t('monitors.cancel')}
        </Button>
        <Button
          variant="primary"
          type="submit"
          disabled={isLoading}
          style={{ minHeight: cssVars.touchTargets.primary }}
          data-testid="monitor-create-submit"
        >
          {isLoading ? t('monitors.creating') : t('monitors.createAndEdit')}
        </Button>
      </div>
    </form>
  );
}
