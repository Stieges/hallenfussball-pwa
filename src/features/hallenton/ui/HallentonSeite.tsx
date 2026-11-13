/**
 * HallentonSeite – der Unterpunkt „Hallenton“ im Admin-Center (H4-8; @HT-016, @HT-017, @HT-022, @HT-041, @HT-042, @HT-046).
 * Oben der Hinweis, wenn die Verwaltung kein Netz hat („Kein Netz – Status unbekannt“, @HT-041) oder das Turnier abgeschlossen ist
 * (lesen ja, ändern nein, @HT-046); darunter „Lautsprecher je Feld“ und „Testton“. Der Bereich „Dieses Gerät“ (Schalter, Einrichtung,
 * Lautstärke) kommt mit H4-9/H4-10 und hat unten seinen Platz. Lesen darf, wer `manageScreens` hat (auch nach dem Abschluss, der
 * Zugang steht im `CategoryRightGate`); jede Taste fragt selbst `useCan('manageScreens')` ohne Ausnahme.
 */
import type { CSSProperties, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Icons } from '../../../components/ui/Icons';
import { InlineNotice } from '../../../components/ui/molecules/InlineNotice';
import { TournamentClosedHint } from '../../../components/ui/molecules/TournamentClosedHint';
import { useCan } from '../../auth/hooks/useCan';
import { useTournamentClosed } from '../../../hooks/useTournamentClosed';
import type { HallStatus } from '../useHallStatus';
import { useHallentonDaten } from '../useHallentonDaten';
import type { FeldKarte } from './feldKarten';
import { FeldKartenAbschnitt } from './FeldKartenAbschnitt';
import { TesttonAbschnitt } from './TesttonAbschnitt';

export interface HallentonSeiteProps {
  tournamentId: string;
  /** Anzahl der Felder des Turniers. */
  felderAnzahl: number;
}

const seiteStil: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.lg };

export function HallentonSeite({ tournamentId, felderAnzahl }: HallentonSeiteProps): ReactElement {
  const darfAendern = useCan('manageScreens', tournamentId);
  const abgeschlossen = useTournamentClosed(tournamentId);
  const { status, lautsprecher, karten, keinLautsprecherImTurnier } = useHallentonDaten(tournamentId, felderAnzahl);
  return (
    <HallentonSeiteAnsicht
      karten={karten}
      keinLautsprecherImTurnier={keinLautsprecherImTurnier}
      status={status}
      darfAendern={darfAendern}
      abgeschlossen={abgeschlossen}
      hierAnhoeren={() => { void lautsprecher.hierAnhoeren('abpfiff'); }}
      geraetName={lautsprecher.name}
    />
  );
}

export interface HallentonSeiteAnsichtProps {
  karten: readonly FeldKarte[];
  keinLautsprecherImTurnier: boolean;
  status: Pick<HallStatus, 'stand' | 'antwort' | 'testtonAnfordern'>;
  /** `useCan('manageScreens')` ohne Ausnahme: nach dem Turnierende falsch, dann steht nur der Status. */
  darfAendern: boolean;
  abgeschlossen: boolean;
  hierAnhoeren: () => void;
  geraetName: string | null;
}

/** Nur Darstellung (auch am Prüfstand der Bilder verwendet): Hinweise oben, Karten je Feld, Testton, Platz für „Dieses Gerät“. */
export function HallentonSeiteAnsicht({ karten, keinLautsprecherImTurnier, status, darfAendern, abgeschlossen, hierAnhoeren, geraetName }: HallentonSeiteAnsichtProps): ReactElement {
  const { t } = useTranslation('hallenton');
  const keinNetz = status.stand === 'unbekannt';
  return (
    <div style={seiteStil} data-testid="hallenton-seite">
      {abgeschlossen ? <TournamentClosedHint live data-testid="hallenton-abgeschlossen" /> : null}
      {keinNetz ? (
        <InlineNotice tone="warn" icon={<Icons.WifiOff size={iconSizeValues.sm} />} data-testid="hallenton-kein-netz">
          <strong>{t('seite.keinNetzTitel')}</strong>
          <span>{t('seite.keinNetzText')}</span>
        </InlineNotice>
      ) : null}
      <FeldKartenAbschnitt karten={karten} keinLautsprecherImTurnier={keinLautsprecherImTurnier && status.stand === 'aktuell'} />
      {darfAendern ? <TesttonAbschnitt karten={karten} status={status} hierAnhoeren={hierAnhoeren} geraetName={geraetName} /> : null}
      {/* Platz für „Dieses Gerät“ (H4-9: Schalter, Einrichtung, Ablösen; H4-10: Lautstärke, Anhören) */}
      <div data-testid="hallenton-dieses-geraet-platz" />
    </div>
  );
}
