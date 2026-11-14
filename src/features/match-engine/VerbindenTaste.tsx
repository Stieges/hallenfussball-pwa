/**
 * VerbindenTaste – die Taste „Verbinden“ an einem Hinweis „kein Netz“ (@OB-087 Zeilen 1 und 2): gleiche Wirkung wie die Pille im Cockpit
 * (`useVerbindenVersuch`: erneut anmelden, wartende Einträge sofort übertragen). Solange der Versuch läuft, steht „Verbinde …“ auf der
 * gesperrten, arbeitenden Taste; ein zweiter Tipp löst nichts aus (die Sperre liegt im Hook). Der Hinweis selbst verschwindet, wenn sein
 * Aufrufer das Netz wieder sieht; `beiEnde` meldet das Ende des Versuchs (z. B. „Liste neu laden“).
 */
import { useEffect, useRef, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { ArbeitsTaste } from '../../components/ui/molecules/ArbeitsTaste';
import { useVerbindenVersuch } from './useVerbindenVersuch';

export interface VerbindenTasteProps {
  'data-testid': string;
  /** Der Versuch ist zu Ende (egal wie): ein Aufrufer lädt hier seine Daten neu. */
  beiEnde?: () => void;
}

export function VerbindenTaste({ 'data-testid': testId, beiEnde }: VerbindenTasteProps): ReactElement {
  const { t } = useTranslation('cockpit');
  const { verbinde, laeuft } = useVerbindenVersuch();
  const warLaeuft = useRef(false);
  const ende = useRef(beiEnde);
  ende.current = beiEnde;
  useEffect(() => {
    if (warLaeuft.current && !laeuft) { ende.current?.(); }
    warLaeuft.current = laeuft;
  }, [laeuft]);
  return (
    <ArbeitsTaste laeuft={laeuft} onClick={verbinde} data-testid={testId}>
      {laeuft ? t('rahmen.verbindet') : t('rahmen.verbinden')}
    </ArbeitsTaste>
  );
}
