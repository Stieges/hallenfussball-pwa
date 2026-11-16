/**
 * AbmeldenDialog – die Rückfragen vor „Abmelden“ (H4-11b, @HT-057). Stufe 1: „Soll „Laptop Turnierleitung“ als Hallen-Lautsprecher für Feld 1 abgemeldet werden?“ und die Folge
 * „Für Feld 1 ertönt danach kein Hallenton, bis ein Gerät wieder eingeschaltet wird.“ (`ConfirmDialog` wie „Ablösen?“). Stufe 2 bei laufendem Spiel: „Auf Feld 1 läuft Spiel 11. … trotzdem
 * abmelden? Danach ertönt für Feld 1 kein Abpfiff.“ als Gefahr-Dialog (@OB-014: Fokus auf „Abbrechen“, Enter löst nichts aus). Gegen Doppeltipp am Handy (die Bestätigungstasten beider Dialoge
 * liegen fast an derselben Stelle) nimmt die Bestätigung der Stufe 2 erst nach `ABMELDEN_SPERRZEIT_MS` Tipps an; bis dahin ist sie sichtbar abgeblendet (`aria-disabled`), „Abbrechen“ geht sofort.
 * Beide nennen Feld und Gerätename; der Gerätename steht nur im Text, nie in einem Attribut. Nur Darstellung mit Props.
 */
import { useEffect, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import type { AbmeldenFrage } from './useLautsprecherAbmelden';

/** So lange nach dem Öffnen der zweiten Rückfrage (Gefahr-Dialog) nimmt „Trotzdem abmelden“ keine Tipps an. */
export const ABMELDEN_SPERRZEIT_MS = 500;

export interface AbmeldenDialogProps {
  frage: AbmeldenFrage | null;
  onJa: () => void;
  onNein: () => void;
}

function ZweiteRueckfrage({ frage, onJa, onNein }: AbmeldenDialogProps & { frage: AbmeldenFrage }): ReactElement {
  const { t } = useTranslation('hallenton');
  const [gesperrt, setGesperrt] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setGesperrt(false), ABMELDEN_SPERRZEIT_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <ConfirmDialog
      title={t('abmelden.spielTitel')}
      message={t('abmelden.spiel', { name: frage.geraetName, feld: frage.feld, spiel: frage.spiel ?? 0 })}
      variant="danger"
      confirmText={t('abmelden.spielBestaetigen')}
      cancelText={t('abmelden.abbrechen')}
      confirmGesperrt={gesperrt}
      onConfirm={onJa}
      onCancel={onNein}
    />
  );
}

export function AbmeldenDialog({ frage, onJa, onNein }: AbmeldenDialogProps): ReactElement | null {
  const { t } = useTranslation('hallenton');
  if (frage === null) {
    return null;
  }
  if (frage.stufe === 2) {
    return <ZweiteRueckfrage key={`${frage.feld}-2-${frage.spiel ?? 0}-${frage.geraetName}`} frage={frage} onJa={onJa} onNein={onNein} />;
  }
  const werte = { name: frage.geraetName, feld: frage.feld };
  return (
    <ConfirmDialog
      key={`${frage.feld}-1-${frage.geraetName}-${String(frage.eigenes)}-${frage.zuordnung ?? 0}`}
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
