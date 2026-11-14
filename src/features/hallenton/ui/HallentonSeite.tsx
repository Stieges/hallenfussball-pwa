/**
 * HallentonSeite – der Unterpunkt „Hallenton“ im Admin-Center (H4-8; @HT-016, @HT-017, @HT-022, @HT-041, @HT-042, @HT-046).
 * Oben der Hinweis, wenn die Verwaltung kein Netz hat („Kein Netz – Status unbekannt“, @HT-041) oder das Turnier abgeschlossen ist
 * (lesen ja, ändern nein, @HT-046); darunter „Lautsprecher je Feld“ und „Testton“. H4-9: der Bereich „Dieses Gerät“ (Einrichtung, Schalter,
 * Ablösen, zweites Turnier; `DiesesGeraetAbschnitt`) steht vor den Karten, solange noch nichts eingerichtet ist oder dieses Gerät selbst
 * Lautsprecher ist, sonst danach (wie im Mockup); die Lautstärke kommt mit H4-10. Lesen darf, wer `manageScreens` hat (auch nach dem Abschluss, der
 * Zugang steht im `CategoryRightGate`); jede Taste fragt selbst `useCan('manageScreens')` ohne Ausnahme.
 */
import type { CSSProperties, ReactElement, ReactNode } from 'react';
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
import { DiesesGeraetAbschnitt } from './DiesesGeraetAbschnitt';
import { FeldKartenAbschnitt } from './FeldKartenAbschnitt';
import { useGeraetAbschnitt } from './useGeraetAbschnitt';
import { TesttonAbschnitt } from './TesttonAbschnitt';

export interface HallentonSeiteProps {
  tournamentId: string;
  /** Anzahl der Felder des Turniers. */
  felderAnzahl: number;
  /** Breite der Seitenleiste links (px): die Fußleiste „Ton aktivieren“ beginnt erst dahinter; ohne Seitenleiste 0. */
  seitenleisteBreite?: number;
}

const seiteStil: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.lg };

export function HallentonSeite({ tournamentId, felderAnzahl, seitenleisteBreite = 0 }: HallentonSeiteProps): ReactElement {
  const darfAendern = useCan('manageScreens', tournamentId);
  const abgeschlossen = useTournamentClosed(tournamentId);
  const daten = useHallentonDaten(tournamentId, felderAnzahl);
  const { status, lautsprecher, karten, keinLautsprecherImTurnier } = daten;
  const geraet = useGeraetAbschnitt({ daten, felderAnzahl, darfAendern });
  return (
    <HallentonSeiteAnsicht
      karten={karten}
      keinLautsprecherImTurnier={keinLautsprecherImTurnier}
      status={status}
      darfAendern={darfAendern}
      abgeschlossen={abgeschlossen}
      hierAnhoeren={() => { void lautsprecher.hierAnhoeren('abpfiff'); }}
      geraetName={lautsprecher.name}
      geraet={<DiesesGeraetAbschnitt abschnitt={geraet} darfAendern={darfAendern} leisteLinks={seitenleisteBreite} />}
      geraetOben={geraet.oben}
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
  /** „Dieses Gerät“ (H4-9). */
  geraet?: ReactNode;
  /** „Dieses Gerät“ steht vor den Feldkarten (Einrichtung, dieses Gerät ist Lautsprecher). */
  geraetOben?: boolean;
}

/** Nur Darstellung (auch am Prüfstand der Bilder verwendet): Hinweise oben, „Dieses Gerät“ (oben oder unten), Karten je Feld, Testton. */
export function HallentonSeiteAnsicht({ karten, keinLautsprecherImTurnier, status, darfAendern, abgeschlossen, hierAnhoeren, geraetName, geraet = null, geraetOben = false }: HallentonSeiteAnsichtProps): ReactElement {
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
      {geraetOben ? geraet : null}
      <FeldKartenAbschnitt karten={karten} keinLautsprecherImTurnier={keinLautsprecherImTurnier && status.stand === 'aktuell'} />
      {darfAendern ? <TesttonAbschnitt karten={karten} status={status} hierAnhoeren={hierAnhoeren} geraetName={geraetName} /> : null}
      {geraetOben ? null : geraet}
    </div>
  );
}
