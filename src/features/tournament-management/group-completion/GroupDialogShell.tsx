/**
 * Gemeinsame Hülle der Dialoge von „Gruppe abschließen“ (GA4 A-13c): Titel mit Schließen-Taste (44 px), scrollender Inhalt
 * (`tabindex=0`, damit er mit der Tastatur erreichbar ist), Tasten-Fuß mit `data-dialog-actions`, Haupttaste oben, alle Tasten
 * untereinander in voller Breite (Mockup A-13c: nie zweizeilige Tasten, auch nicht auf dem Laptop).
 */
import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, dialogWidths, iconSizeValues } from '../../../design-tokens';
import { Icons } from '../../../components/ui/Icons';
import { DialogSurface } from '../../../components/ui/molecules/DialogSurface';

export interface GroupDialogShellProps {
  title: string;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
  'data-testid': string;
  /** Rolle `alertdialog` für Meldungen, die eine Kenntnisnahme verlangen. */
  alert?: boolean;
}

const header: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: cssVars.spacing.sm,
  padding: `${cssVars.spacing.md} ${cssVars.spacing.sm} ${cssVars.spacing.sm} ${cssVars.spacing.md}`,
};
const closeStyle: CSSProperties = {
  width: cssVars.touchTargets.minimum, height: cssVars.touchTargets.minimum, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'none', border: 0, color: cssVars.colors.textPrimary, cursor: 'pointer', flex: 'none',
};
const dialogBody: CSSProperties = { display: 'grid', gap: cssVars.spacing.sm, padding: `0 ${cssVars.spacing.md} ${cssVars.spacing.md}` };
/** Fuß: untereinander, Haupttaste zuerst (oben, auch in der Tab-Reihenfolge). */
const dialogFooterStack: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.sm };

export const GroupDialogShell = ({ title, onClose, footer, children, 'data-testid': testId, alert = false }: GroupDialogShellProps) => {
  const { t } = useTranslation('tournament');
  const head = (
    <div style={header}>
      <h2 id={`${testId}-title`} style={{ margin: 0, fontSize: cssVars.fontSizes.xl, lineHeight: cssVars.lineHeights.title }}>{title}</h2>
      <button type="button" onClick={onClose} aria-label={t('groupCompletion.dialog.close')} data-testid={`${testId}-close`} style={closeStyle}>
        <Icons.X size={iconSizeValues.sm} />
      </button>
    </div>
  );
  return (
    <DialogSurface
      isOpen
      onClose={onClose}
      labelledBy={`${testId}-title`}
      header={head}
      footer={<div style={dialogFooterStack} data-dialog-actions>{footer}</div>}
      testId={testId}
      maxWidth={dialogWidths.md}
      role={alert ? 'alertdialog' : 'dialog'}
    >
      <div style={dialogBody} tabIndex={0}>{children}</div>
    </DialogSurface>
  );
};
