/**
 * Rückfragen der Seite „Team & Helfer“ (A-18a, Mockup M4 `r5`/`r6`/`r7`): Code erneuern (mit offenen Anfragen: behalten oder
 * ablehnen, @HE-008, @HE-102), Zugang entziehen (@HE-055, @HE-104, @HE-080) und zum Zuschauer machen (@HE-055 Zeile 2).
 * Die Texte sagen, was das Gerät der Person danach sieht und dass Zugänge nie gelöscht werden. Die Haupttaste steht unten
 * (`DialogActions`); „Abbrechen“ lässt alles unverändert. Der Aufrufer führt die Aktion aus – hier geschieht nichts selbst.
 */
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../../../../components/dialogs/Dialog';
import { Icons } from '../../../../components/ui/Icons';
import { DialogActions } from '../../../../components/ui/molecules/DialogActions';
import { cssVars, iconSizeValues } from '../../../../design-tokens';
import { deviceLabelText } from '../../../../core/device/deviceLabel';
import type { HelperRowModel } from './helperAdminModel';

// tabIndex={0} am ersten Absatz: Scrollt der Inhalt am kleinen Handy und enthält keine Taste, braucht der Bereich einen Tastaturzugang (axe scrollable-region-focusable)
const stack: CSSProperties = { display: 'grid', gap: cssVars.spacing.md };
const ctx: CSSProperties = { margin: 0, color: cssVars.colors.textPrimary, fontSize: cssVars.fontSizes.md, lineHeight: cssVars.lineHeights.bodyMd };
const nameLine: CSSProperties = { display: 'block', fontWeight: cssVars.fontWeights.bold, fontSize: cssVars.fontSizes.lg, lineHeight: cssVars.lineHeights.title, overflowWrap: 'break-word' };
const effect: CSSProperties = {
  display: 'flex', gap: cssVars.spacing.sm, alignItems: 'flex-start', padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.infoBorder}`, borderRadius: cssVars.borderRadius.md, backgroundColor: cssVars.colors.background,
  backgroundImage: `linear-gradient(${cssVars.colors.infoLight}, ${cssVars.colors.infoLight})`, fontSize: cssVars.fontSizes.md, lineHeight: cssVars.lineHeights.bodyMd, color: cssVars.colors.textPrimary,
};

const Effect = ({ children }: { children: string }) => (
  <div style={effect}>
    <span style={{ color: cssVars.colors.info, display: 'flex' }} aria-hidden="true"><Icons.Info size={iconSizeValues.sm} /></span>
    <span>{children}</span>
  </div>
);

export interface RenewCodeDialogProps {
  openRequests: number;
  busy: boolean;
  onRenew: (openRequests: 'keep' | 'decline') => void;
  onClose: () => void;
}

export const RenewCodeDialog = ({ openRequests, busy, onRenew, onClose }: RenewCodeDialogProps) => {
  const { t } = useTranslation('admin');
  // Abbrechen, Ablehnen, dann die Haupttaste (unten, @OB-061): wie jeder Dialog-Fuß der App
  const footer = (
    <DialogActions
      secondary={[
        { label: t('teamHelpers.renew.cancel'), onClick: onClose, 'data-testid': 'renew-cancel' },
        ...(openRequests > 0 ? [{ label: t('teamHelpers.renew.decide', { count: openRequests }), onClick: () => onRenew('decline'), disabled: busy, 'data-testid': 'renew-decline' }] : []),
      ]}
      primary={{
        label: openRequests > 0 ? t('teamHelpers.renew.keep', { count: openRequests }) : t('teamHelpers.renew.confirm'),
        onClick: () => onRenew('keep'),
        disabled: busy,
        'data-testid': openRequests > 0 ? 'renew-keep' : 'renew-confirm',
      }}
    />
  );
  return (
    <Dialog isOpen onClose={onClose} title={t('teamHelpers.renew.title')} footer={footer}>
      <div style={stack} data-testid="renew-dialog">
        <p style={ctx} tabIndex={0}>{t('teamHelpers.renew.text')}</p>
        {openRequests > 0 ? <p style={{ ...ctx, fontWeight: cssVars.fontWeights.bold }}>{t('teamHelpers.renew.question', { count: openRequests })}</p> : null}
        {openRequests > 0 ? <Effect>{t('teamHelpers.renew.effect')}</Effect> : null}
      </div>
    </Dialog>
  );
};

export interface AccessChangeDialogProps {
  kind: 'revoke' | 'watch_only';
  row: HelperRowModel;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const AccessChangeDialog = ({ kind, row, busy, onConfirm, onClose }: AccessChangeDialogProps) => {
  const { t } = useTranslation('admin');
  const prefix = kind === 'revoke' ? 'teamHelpers.revoke' : 'teamHelpers.viewer';
  const field = row.field === null ? t('teamHelpers.helpers.noField') : t('teamHelpers.helpers.field', { field: row.field });
  const device = deviceLabelText(row.deviceLabel) ?? t('teamHelpers.helpers.deviceUnknown');
  const where = t('teamHelpers.where', { field, device });
  const name = row.name;
  const footer = (
    <DialogActions
      secondary={[{ label: t(`${prefix}.cancel`), onClick: onClose, 'data-testid': 'access-cancel' }]}
      primary={{ label: t(`${prefix}.confirm`), onClick: onConfirm, disabled: busy, 'data-testid': kind === 'revoke' ? 'helper-revoke-confirm' : 'helper-viewer-confirm' }}
      primaryVariant={kind === 'revoke' ? 'danger' : 'primary'}
    />
  );
  return (
    <Dialog isOpen onClose={onClose} title={t(`${prefix}.title`, { name })} footer={footer}>
      <div style={stack} data-testid="access-dialog" data-kind={kind}>
        <p style={ctx} tabIndex={0}><b style={nameLine} data-teamname>{name}</b>{' '}{t(`${prefix}.intro`, { where })}</p>
        <Effect>{t(`${prefix}.effectSeen`, { name })}</Effect>
        <Effect>{t(`${prefix}.effectBlock`, { name })}</Effect>
        {kind === 'revoke' ? <Effect>{t('teamHelpers.revoke.effectNothing', { name })}</Effect> : null}
      </div>
    </Dialog>
  );
};
