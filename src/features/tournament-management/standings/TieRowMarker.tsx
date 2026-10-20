/**
 * Marke an einer Tabellenzeile (Paket TB-B, TB-6b; Daniel G5): Symbol und Wort für offenen Gleichstand und für das, was
 * entschieden wurde. In der Zuschauer-Ansicht und auf dem Monitor wird sie nie gerendert (@W2A-059). Das Ergebnis des
 * Strafstoßschießens steht aus Sicht des Teams („4:3“ beim Sieger, „3:4“ beim Unterlegenen).
 */
import { useTranslation } from 'react-i18next';
import { TieMarker as TieMarkerBadge } from '../../../components/ui/molecules/TieMarker';
import type { TieMarker } from '../../../core/standings/tieViews';

export const TieRowMarker = ({ marker }: { marker: TieMarker | undefined }) => {
  if (marker === undefined) {
    return null;
  }
  // eigener Block unter dem Teamnamen (nicht neben dem Namen)
  return <div><MarkerBadge marker={marker} /></div>;
};

const MarkerBadge = ({ marker }: { marker: TieMarker }) => {
  const { t } = useTranslation('tournament');
  switch (marker.kind) {
  case 'need':
    return <TieMarkerBadge tone="warn" symbol="warn" data-kind="need">{t('standingsTie.marker.need')}</TieMarkerBadge>;
  case 'open':
    return <TieMarkerBadge tone="warn" symbol="warn" data-kind="open">{t('standingsTie.marker.open')}</TieMarkerBadge>;
  case 'same':
    return <TieMarkerBadge tone="done" symbol="equal" data-kind="same">{t('standingsTie.marker.same')}</TieMarkerBadge>;
  case 'ordered':
    return <TieMarkerBadge tone="done" symbol="check" data-kind="ordered">{t('standingsTie.marker.ordered')}</TieMarkerBadge>;
  case 'shootoutWon':
    return <TieMarkerBadge tone="done" symbol="check" data-kind="shootoutWon">{t('standingsTie.marker.shootout', { own: marker.winner, other: marker.loser })}</TieMarkerBadge>;
  case 'shootoutLost':
    return <TieMarkerBadge tone="done" symbol="check" data-kind="shootoutLost">{t('standingsTie.marker.shootout', { own: marker.loser, other: marker.winner })}</TieMarkerBadge>;
  }
};
