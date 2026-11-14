/**
 * GeraetRueckfragen – die zwei Rückfragen beim Einschalten (H4-9): „Ablösen?“ (@HT-015: das Feld hat schon einen Hallen-Lautsprecher; der alte
 * zeigt danach „von einem anderen Gerät übernommen“, ohne Knopf zum Zurückholen) und „Wechseln?“ (@HT-056: dieses Gerät ist schon Lautsprecher
 * für ein anderes Turnier). Beide sind `ConfirmDialog`: Abbrechen ändert nichts. Nur Darstellung mit Props.
 */
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';

export interface AbloesenFrage {
  felder: readonly number[];
  /** Wer die Felder bisher hat (Server: Feld und Gerätename). */
  belegt: ReadonlyArray<{ field: number; deviceName: string }>;
  /** Eigener Gerätename (Teil der Folge-Zeile). */
  eigenerName: string;
}

export interface WechselFrage {
  /** Name des anderen Turniers aus dem lokalen Turnier; `null`, wenn es hier nicht liegt. */
  turnierName: string | null;
}

export interface GeraetRueckfragenProps {
  abloesen: AbloesenFrage | null;
  wechseln: WechselFrage | null;
  onAbloesen: () => void;
  onAbloesenAbbrechen: () => void;
  onWechseln: () => void;
  onWechselnAbbrechen: () => void;
}

export function GeraetRueckfragen({ abloesen, wechseln, onAbloesen, onAbloesenAbbrechen, onWechseln, onWechselnAbbrechen }: GeraetRueckfragenProps): ReactElement {
  const { t } = useTranslation('hallenton');
  const frage = abloesen === null ? '' : abloesen.belegt.length === 1
    ? t('abloesen.frage', { feld: abloesen.belegt[0].field, name: abloesen.belegt[0].deviceName })
    : t('abloesen.frageMehrere', { liste: abloesen.belegt.map((b) => `${t('feld.titel', { feld: b.field })} (${b.deviceName})`).join(', ') });
  return (
    <>
      {wechseln === null ? null : (
        <ConfirmDialog
          title={t('wechseln.titel')}
          message={`${wechseln.turnierName === null ? t('wechseln.frageOhneName') : t('wechseln.frage', { turnier: wechseln.turnierName })}\n\n${t('wechseln.folge')}`}
          variant="warning"
          confirmText={t('wechseln.bestaetigen')}
          cancelText={t('wechseln.abbrechen')}
          onConfirm={onWechseln}
          onCancel={onWechselnAbbrechen}
        />
      )}
      {abloesen === null ? null : (
        <ConfirmDialog
          title={t('abloesen.titel')}
          message={`${frage}\n\n${t('abloesen.folge', { eigen: abloesen.eigenerName, felder: abloesen.felder.map((f) => t('feld.titel', { feld: f })).join(', ') })}`}
          variant="warning"
          confirmText={t('abloesen.bestaetigen')}
          cancelText={t('abloesen.abbrechen')}
          onConfirm={onAbloesen}
          onCancel={onAbloesenAbbrechen}
        />
      )}
    </>
  );
}
