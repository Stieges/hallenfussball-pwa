/**
 * HallStatusZeile – Adapter der Statuszeile zum Hallen-Lautsprecher (H4-5, G6, @HT-045): baut aus `hallAnzeige` die Einträge und
 * rendert `StatusZeile` unter der Kopfzeile von Verwaltung und Cockpit. Nur mit dem Recht `manageScreens` (Helfer sehen keine Zeile
 * und fragen den Server nicht); ohne Lautsprecher im Turnier und ohne Probe steht nichts da. Die Kopfzeile ist Host (`StatusZeileOrt`):
 * der Streifen ohne Kopf bleibt dann aus. `probe` ist der Platz der Probe-Sitzung (`StatusEintrag` mit `rang: 'probe'`).
 */
import { useCallback, useContext, useMemo, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { StatusZeile } from '../../../components/ui/molecules/StatusZeile';
import type { StatusEintrag } from '../../../components/ui/molecules/statusZeileTypen';
import { AuthContext } from '../../auth/context/authContextInstance';
import { useCan } from '../../auth/hooks/useCan';
import { hallAnzeige, type HallAnzeige } from '../hallAnzeige';
import { hallAnzeigeOhneGezeigtenKasten } from '../hallAnzeigeCockpit';
import { useHallLautsprecher } from '../useHallLautsprecher';
import { useLaufendeSpiele } from '../useLaufendeSpiele';
import { useAnderesFensterTont } from '../useAnderesFensterTont';
import { useHallStatus } from '../useHallStatus';
import { abgemeldeteFelder, baueStatusEintraege, hallentonZiel } from './hallStatusEintraege';
import { useCockpitKastenFelder } from './CockpitKastenOrt';
import { useStatusZeileHost } from './StatusZeileOrt';

export interface HallStatusZeileProps {
  tournamentId: string;
  /** Im Unterpunkt „Hallenton“ entfällt der Lautsprecher-Eintrag (Regel 8). */
  ohneLautsprecher?: boolean;
  /** Eintrag der Probe-Sitzung (`rang: 'probe'`); `null` = keine Probe. */
  probe?: StatusEintrag | null;
  /**
   * Cockpit (@HT-059): nur Störungen (und die Probe); „bereit“ samt „Prüfen“ und Hinweise entfallen, ebenso „Status unbekannt“ und eine Störung des
   * gezeigten Felds, die der Kasten unter der Tafel schon zeigt (H4-18). Die Kopfzeile bleibt Host.
   */
  nurStoerungen?: boolean;
}

export function HallStatusZeile(props: HallStatusZeileProps): ReactElement | null {
  // Ohne Anmeldung-Umgebung (Prüfstände, Tests ohne Provider) gibt es kein Recht und damit keine Zeile; in der App steht der Provider immer
  return useContext(AuthContext) === undefined ? null : <HallStatusZeileMitAuth {...props} />;
}

function HallStatusZeileMitAuth(props: HallStatusZeileProps): ReactElement | null {
  const darf = useCan('manageScreens', props.tournamentId);
  return darf ? <HallStatusZeileMitRecht key={props.tournamentId} {...props} /> : null;
}

export interface HallStatusZeileAnsichtProps {
  anzeige: HallAnzeige;
  tournamentId: string;
  tonAktivieren: () => void;
  ohneLautsprecher?: boolean;
  /** Felder, die die Turnierleitung für dieses Gerät abgemeldet hat (bis „Verstanden“, @HT-057). */
  abgemeldet?: readonly number[];
  probe?: StatusEintrag | null;
  nurStoerungen?: boolean;
  'data-testid'?: string;
}

/** Nur Darstellung: Einträge aus der Anzeige bauen und die Zeile rendern (auch am Prüfstand der Bilder verwendet). */
export function HallStatusZeileAnsicht({ anzeige, tournamentId, tonAktivieren, ohneLautsprecher, abgemeldet, probe, nurStoerungen, 'data-testid': testId = 'hallenton-status-zeile' }: HallStatusZeileAnsichtProps): ReactElement | null {
  const { t } = useTranslation('hallenton');
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();
  const eintraege = useMemo(() => {
    const alle = baueStatusEintraege(anzeige, { t, ziel: hallentonZiel(tournamentId), tonAktivieren, ohneLautsprecher, abgemeldet, probe });
    return nurStoerungen ? alle.filter((e) => (e.rang === 'stoerung' || e.rang === 'probe') && e.id !== 'statusUnbekannt') : alle;
  }, [anzeige, t, tournamentId, tonAktivieren, ohneLautsprecher, abgemeldet, probe, nurStoerungen]);
  return (
    <StatusZeile
      eintraege={eintraege}
      weitereText={(count) => t('statuszeile.weitere', { count })}
      wenigerText={t('statuszeile.weniger')}
      onNavigiere={(ziel) => { void navigate(ziel); }}
      label={tCommon('statusZeile.titel')}
      data-testid={testId}
    />
  );
}

function HallStatusZeileMitRecht({ tournamentId, ohneLautsprecher = false, probe = null, nurStoerungen = false }: HallStatusZeileProps): ReactElement | null {
  const status = useHallStatus(tournamentId);
  const lautsprecher = useHallLautsprecher(tournamentId);
  useStatusZeileHost(tournamentId);

  const { laufzeit, felder, tonAktivieren } = lautsprecher;
  const lokal = useMemo(
    () => (laufzeit === null ? null : { felder, rolle: laufzeit.rolle, zustandJeFeld: laufzeit.zustandJeFeld }),
    [laufzeit, felder],
  );
  const anderesFenster = useAnderesFensterTont(lokal);
  // „Ein Lautsprecher war bekannt“ gilt je Turnier für die Sitzung (`useHallStatus`) oder wenn dieses Gerät selbst Lautsprecher ist (@HT-041, @HT-038)
  const laufendeSpiele = useLaufendeSpiele(tournamentId, status.antwort);
  const angepfiffen = useMemo(() => new Set(laufendeSpiele.keys()), [laufendeSpiele]);
  const anzeige = useMemo(
    () => hallAnzeige({
      server: { stand: status.stand, felder: status.felder, antwort: status.antwort }, lokal, angepfiffen,
      lautsprecherBekannt: status.lautsprecherBekannt || (lokal !== null && lokal.felder.length > 0),
      anderesFensterTont: anderesFenster,
    }),
    [status.stand, status.felder, status.antwort, status.lautsprecherBekannt, lokal, angepfiffen, anderesFenster],
  );
  const aktivieren = useCallback(() => { void tonAktivieren(); }, [tonAktivieren]);
  const abgemeldet = useMemo(() => abgemeldeteFelder(lautsprecher.abgeloest), [lautsprecher.abgeloest]);
  // Nur im Cockpit (H4-18): was der Kasten unter der Tafel zeigt, steht nicht zusätzlich als Pille im Kopf
  const kastenFelder = useCockpitKastenFelder(tournamentId);
  const sichtbar = useMemo(() => (nurStoerungen ? hallAnzeigeOhneGezeigtenKasten(anzeige, kastenFelder) : anzeige), [nurStoerungen, anzeige, kastenFelder]);
  return <HallStatusZeileAnsicht anzeige={sichtbar} tournamentId={tournamentId} tonAktivieren={aktivieren} ohneLautsprecher={ohneLautsprecher} abgemeldet={abgemeldet} probe={probe} nurStoerungen={nurStoerungen} />;
}
