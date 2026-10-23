/**
 * TakeoverDialog (B-49): Rückfrage „Spielleitung übernehmen?“ für ein fremd gesteuertes Feld – im Cockpit (@FU-027, @SL-046,
 * @SL-015) und im Spielplan (@FU-081 „Feld 2 wird gerade von Tom gesteuert“ mit „Spielleitung übernehmen“).
 *
 * Der Hinweis nennt den Halter („Tom (Handy)“, ohne Namen „einem anderen Gerät“) und die Folge (das andere Gerät trägt nicht mehr
 * ein). Scheitert die Übernahme, bleibt der Dialog offen und nennt den Grund (`fehler`, z. B. „Übernehmen geht nur mit Netz“,
 * @FU-028). Während des Aufrufs ist die Haupttaste gesperrt (kein Doppel-Tipp).
 */
import { useRef, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../design-tokens';
import { DialogActions } from '../ui/molecules/DialogActions';
import { Dialog } from './Dialog';

export interface TakeoverDialogProps {
  isOpen: boolean;
  /** Anzeigename des Felds, z. B. „Feld 2“. */
  feldName: string;
  /** Halter, z. B. „Tom (Handy)“; `null` = ohne Namen. */
  halter: string | null;
  busy: boolean;
  /** Grund, warum die Übernahme nicht geklappt hat; `null` = kein Fehler. */
  fehler: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const textStyle: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.bodySm, color: cssVars.colors.textPrimary };
const hinweisStyle: CSSProperties = { ...textStyle, fontWeight: cssVars.fontWeights.semibold };
const fehlerStyle: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.bodySm, color: cssVars.colors.error };
const bodyStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.md };

export function TakeoverDialog({ isOpen, feldName, halter, busy, fehler, onConfirm, onCancel }: TakeoverDialogProps) {
  const { t } = useTranslation('cockpit');
  const abbrechenRef = useRef<HTMLButtonElement>(null);
  const footer = (
    <DialogActions
      secondary={[{ label: t('steuer.abbrechen'), onClick: onCancel, 'data-testid': 'takeover-cancel', buttonRef: abbrechenRef }]}
      primary={{ label: t('steuer.bestaetigen'), onClick: onConfirm, disabled: busy, 'data-testid': 'takeover-confirm' }}
      data-testid="takeover-actions"
    />
  );
  return (
    <Dialog isOpen={isOpen} onClose={onCancel} title={t('steuer.titel')} footer={footer} initialFocusRef={abbrechenRef} suppressEnter>
      <div style={bodyStyle} data-testid="takeover-dialog">
        <p style={hinweisStyle} data-testid="takeover-halter">
          {halter !== null ? t('steuer.gesteuert', { feld: feldName, name: halter }) : t('steuer.gesteuertOhneName', { feld: feldName })}
        </p>
        <p style={textStyle}>{t('steuer.folge', { feld: feldName })}</p>
        {fehler !== null && <p role="alert" style={fehlerStyle} data-testid="takeover-fehler">{fehler}</p>}
      </div>
    </Dialog>
  );
}
