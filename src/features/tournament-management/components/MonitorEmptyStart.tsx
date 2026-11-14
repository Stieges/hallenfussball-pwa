/**
 * Leerer Reiter „Monitor“ (@ME-074): „Hallen-Standard anlegen“ ist die Haupttaste, darunter ein Satz, was sie anlegt;
 * „Leer anlegen“ und „Aus anderem Turnier übernehmen“ folgen als weitere Tasten.
 */

import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, dialogWidths } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';

interface MonitorEmptyStartProps {
  /** Tasten nur mit dem Recht „Bildschirme verwalten“ (@ZM-019); sonst bleibt nur der Hinweis */
  canManage: boolean;
  /** Recht „Bildschirme verwalten“: nur dann steht die Aufforderung „Lege einen Monitor an …“ da (auch während des Anlegens) */
  hasRight: boolean;
  /** Mehrere Felder: der Hinweis nennt, dass die Live-Folie von Feld 1 gezeigt wird (@ME-074) */
  multipleFields: boolean;
  isLoading: boolean;
  onHallenStandard: () => void;
  onCreateEmpty: () => void;
  onTransfer: () => void;
}

const boxStyle: CSSProperties = {
  padding: cssVars.spacing.xl,
  textAlign: 'center',
  color: cssVars.colors.textSecondary,
  background: cssVars.colors.surfaceLight,
  borderRadius: cssVars.borderRadius.lg,
  border: `1px dashed ${cssVars.colors.border}`,
};

const actionsStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: cssVars.spacing.sm,
  maxWidth: dialogWidths.sm,
  margin: `${cssVars.spacing.lg} auto 0`,
};

const hintStyle: CSSProperties = {
  margin: `0 0 ${cssVars.spacing.md}`,
  fontSize: cssVars.fontSizes.md,
  color: cssVars.colors.textSecondary,
};

export function MonitorEmptyStart({ canManage, hasRight, multipleFields, isLoading, onHallenStandard, onCreateEmpty, onTransfer }: MonitorEmptyStartProps) {
  const { t } = useTranslation('tournament');

  return (
    <div style={boxStyle} data-testid="monitors-empty-start">
      <div style={{ fontSize: cssVars.iconSizes.xl, marginBottom: cssVars.spacing.md }} aria-hidden="true">📺</div>
      <h3 style={{ margin: 0, color: cssVars.colors.textPrimary }}>{t('monitors.emptyState')}</h3>
      {hasRight && (
        <p style={{ margin: `${cssVars.spacing.sm} 0 0`, maxWidth: dialogWidths.sm, marginInline: 'auto' }}>
          {t('monitors.emptyStateHint')}
        </p>
      )}
      {canManage && (
        <div style={actionsStyle}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={onHallenStandard}
            busy={isLoading}
            style={{ minHeight: cssVars.touchTargets.primary }}
            data-testid="monitors-start-hallen-standard"
          >
            {t('monitors.emptyStart.hallenStandard')}
          </Button>
          <p style={hintStyle} data-testid="monitors-start-hallen-standard-hint">
            {t(multipleFields ? 'monitors.emptyStart.hallenStandardHintMultiField' : 'monitors.emptyStart.hallenStandardHint')}
          </p>
          <Button variant="secondary" fullWidth onClick={onCreateEmpty} data-testid="monitors-start-empty">
            {t('monitors.emptyStart.createEmpty')}
          </Button>
          <Button variant="secondary" fullWidth onClick={onTransfer} data-testid="monitors-transfer-open">
            {t('monitors.emptyStart.transfer')}
          </Button>
        </div>
      )}
    </div>
  );
}
