/**
 * AbmeldenDialog – die Rückfragen vor „Abmelden“ (H4-11b, @HT-057). Stufe 1: „Soll „Laptop Turnierleitung“ als Hallen-Lautsprecher für Feld 1 abgemeldet werden?“ und die Folge
 * „Für Feld 1 ertönt danach kein Hallenton, bis ein Gerät wieder eingeschaltet wird.“ (`ConfirmDialog` wie „Ablösen?“). Stufe 2 bei laufendem Spiel: „Auf Feld 1 läuft Spiel 11. … trotzdem
 * abmelden? Danach ertönt für Feld 1 kein Abpfiff.“ als Gefahr-Dialog (@OB-014: Fokus auf „Abbrechen“, Enter löst nichts aus – kein Durchtippen von zwei Dialogen). Beide nennen Feld und
 * Gerätename. Der Gerätename steht nur im Text, nie in einem Attribut. Nur Darstellung mit Props.
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
  const werte = { name: frage.geraetName, feld: frage.feld, spiel: frage.spiel ?? 0 };
  if (frage.stufe === 2) {
    return (
      <ConfirmDialog
        key={`${frage.feld}-2-${frage.spiel ?? 0}`}
        title={t('abmelden.spielTitel')}
        message={t('abmelden.spiel', werte)}
        variant="danger"
        confirmText={t('abmelden.spielBestaetigen')}
        cancelText={t('abmelden.abbrechen')}
        onConfirm={onJa}
        onCancel={onNein}
      />
    );
  }
  return (
    <ConfirmDialog
      key={`${frage.feld}-1-${frage.geraetName}-${String(frage.eigenes)}`}
      title={t('abmelden.titel')}
      message={`${t('abmelden.frage', werte)}\n\n${t(frage.eigenes ? 'abmelden.folgeEigenes' : 'abmelden.folge', werte)}`}
      variant="warning"
      confirmText={t('abmelden.bestaetigen')}
      cancelText={t('abmelden.abbrechen')}
      onConfirm={onJa}
      onCancel={onNein}
    />
  );
}
