/**
 * Punkt „Meine Turniere auf diesem Handy“ im Blatt „Mehr“ des Live-Cockpits (A-17c-2, @HE-110). Erscheint nur, wenn das Gerät
 * eigene Turniere hat und Tom hier als Helfer arbeitet (`useOwnTournamentsOffer`); der Tipp führt zur Startseite.
 */
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { cssVars } from '../../../design-tokens';
import { markHelperStartHandled } from '../helperStartDeps';
import { useHelperAccessHere, useOwnTournamentsOffer } from '../useOwnTournamentsOffer';

export interface OwnTournamentsMoreItemProps {
  tournamentId: string;
  /** Vor dem Wechsel das Blatt schließen. */
  onBeforeNavigate?: () => void;
}

const OwnTournamentsMoreButton = ({ onBeforeNavigate }: Pick<OwnTournamentsMoreItemProps, 'onBeforeNavigate'>) => {
  const { t } = useTranslation('helpers');
  const navigate = useNavigate();
  const offer = useOwnTournamentsOffer();
  if (!offer) {
    return null;
  }
  return (
    <Button
      variant="secondary"
      style={{ minHeight: cssVars.touchTargets.primary, width: '100%' }}
      data-testid="mehr-meine-turniere"
      onClick={() => { markHelperStartHandled(); onBeforeNavigate?.(); void navigate('/'); }}
    >
      {t('mehr.meineTurniere')}
    </Button>
  );
};

/** Ohne Helfer-Zugang zu diesem Turnier erscheint nichts und es wird nichts geladen. */
export const OwnTournamentsMoreItem = ({ tournamentId, onBeforeNavigate }: OwnTournamentsMoreItemProps) =>
  useHelperAccessHere(tournamentId) === null ? null : <OwnTournamentsMoreButton onBeforeNavigate={onBeforeNavigate} />;
