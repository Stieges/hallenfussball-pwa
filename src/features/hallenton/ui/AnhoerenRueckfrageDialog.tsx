/**
 * AnhoerenRueckfrageDialog – die Rückfrage aus `useAnhoerenRueckfrage` (H4-10, @HT-017): „Auf Feld 1 läuft Spiel 11. Testton trotzdem in der
 * Halle spielen?“ bzw. „… Trotzdem anhören?“. Ein `ConfirmDialog`: Abbrechen spielt nichts. Nur Darstellung mit Props.
 */
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import type { OffeneRueckfrage } from './useAnhoerenRueckfrage';

export interface AnhoerenRueckfrageDialogProps {
  frage: OffeneRueckfrage | null;
  onJa: () => void;
  onNein: () => void;
}

export function AnhoerenRueckfrageDialog({ frage, onJa, onNein }: AnhoerenRueckfrageDialogProps): ReactElement | null {
  const { t } = useTranslation('hallenton');
  if (frage === null) {
    return null;
  }
  const lage = frage.laufende.map((l) => t('rueckfrage.laeuftSpiel', { feld: l.feld, spiel: l.spiel })).join(' ');
  const testton = frage.art === 'testton';
  return (
    <ConfirmDialog
      title={testton ? t('rueckfrage.testtonTitel') : t('rueckfrage.anhoerenTitel')}
      message={testton ? t('rueckfrage.testton', { lage }) : t('rueckfrage.anhoeren', { lage })}
      variant="warning"
      confirmText={testton ? t('rueckfrage.testtonBestaetigen') : t('rueckfrage.anhoerenBestaetigen')}
      cancelText={t('rueckfrage.abbrechen')}
      onConfirm={onJa}
      onCancel={onNein}
    />
  );
}
