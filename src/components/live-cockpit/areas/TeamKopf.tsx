/**
 * TeamKopf – Kopf einer Team-Spalte: Name und „Heim/Gast“ auf der Farbe des Ergebniskastens (@SL-176; Scheibe 3, Aufgabe 3.3; @OB-025).
 * Gemeinsam für die Tastenspalte (`TeamColumn`) und die Zusammenfassung nach dem Abpfiff (`TeamSummary`, B-10a2), damit der Name in beiden
 * gleich umbricht: nie getrennt, kleiner statt gekürzt (VISUAL-DESIGN § 1/§ 2). Kennungen `team-head-`, `team-name-<Seite>`.
 * Die Farbe ist die getragene Farbe (Weste bei Leibchen) wie im Kasten und am Hallenmonitor, nie die der Tasten.
 */
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import type { SideBox } from '../../../core/models/scoreBoxColors';
import { TeamHeadBar } from '../../ui/molecules/TeamHeadBar';
import type { Side } from '../model/cockpitTypes';

export interface TeamKopfProps {
  seite: Side;
  name: string;
  /** Fläche des Kastens dieser Seite (`MatchView.boxes`); ohne sie die Standardfarbe der Seite. */
  kasten: SideBox;
  /** Ab 1024 px größere Schrift im Kopf. */
  breit?: boolean;
}

export function TeamKopf({ seite, name, kasten, breit = false }: TeamKopfProps): ReactElement {
  const { t } = useTranslation('cockpit');
  return (
    <TeamHeadBar
      name={name} label={t(seite === 'home' ? 'spalte.heim' : 'spalte.gast')} fill={kasten.fill} breit={breit}
      bib={kasten.bib ? { ariaLabel: t('spalte.leibchen') } : null}
      testId={`team-head-${seite}`} nameTestId={`team-name-${seite}`}
    />
  );
}
