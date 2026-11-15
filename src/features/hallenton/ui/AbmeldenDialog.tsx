/**
 * AbmeldenDialog – die Rückfrage vor „Abmelden“ (H4-11b, @HT-057): „Soll „Laptop Turnierleitung“ als Hallen-Lautsprecher für Feld 1 abgemeldet werden?“ und die Folge
 * „Für Feld 1 ertönt danach kein Hallenton, bis ein Gerät wieder eingeschaltet wird.“ Ein `ConfirmDialog` wie „Ablösen?“ (@HT-015): Abbrechen ändert nichts. Der Gerätename
 * steht nur im Text, nie in einem Attribut. Nur Darstellung mit Props.
 */
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import type { AbmeldenFrage } from './useLautsprecherAbmelden';

export interface AbmeldenDialogProps {
  frage: AbmeldenFrage | null;
  onJa: () => void;
  onNein: () => void;
}

export function AbmeldenDialog({ frage, onJa, onNein }: AbmeldenDialogProps): ReactElement | null {
  const { t } = useTranslation('hallenton');
  if (frage === null) {
    return null;
  }
  return (
    <ConfirmDialog
      title={t('abmelden.titel')}
      message={`${t('abmelden.frage', { name: frage.geraetName, feld: frage.feld })}\n\n${t(frage.eigenes ? 'abmelden.folgeEigenes' : 'abmelden.folge', { feld: frage.feld })}`}
      variant="warning"
      confirmText={t('abmelden.bestaetigen')}
      cancelText={t('abmelden.abbrechen')}
      onConfirm={onJa}
      onCancel={onNein}
    />
  );
}
