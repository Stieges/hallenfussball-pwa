/**
 * LiveCockpit - Live Match Control Interface
 *
 * A touch-optimized interface for tournament directors to manage live matches.
 * Features: Timer, Score Control, Event Tracking, Fouls, Cards, Substitutions.
 *
 * Hülle (Scheibe 1): bindet Bereichs-Hooks an Bereiche. Befehle und Effekte stehen in
 * `hooks/useCockpitCommands.ts`, Darstellung in `areas/`, Stile in `LiveCockpitShell.module.css`.
 *
 * Layout (`data-layout`, die eine Quelle für Leiste und Anordnung): `breit` ab 1024 px (Spalten + Ereignis-Sidebar),
 * darunter `daumen` (gestapelt, Ereignisse über den Leisten-Knopf). Die Daumenleiste steht unten (Aufgabe 3.6).
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useBreakpoint, useMatchTimerExtended, useMatchSound } from '../../hooks';
import { breakpointValues } from '../../design-tokens';
import { useFoulZaehler } from './hooks/useFoulZaehler';
import { AwaitingServerCopyLine, SyncStatusIndicator } from '../../features/collaboration';
import { OutboxNotice } from '../../features/collaboration/outbox/OutboxNotice';
import { useUebergabe } from '../../features/klaerungsliste/useUebergabe';
import { useVerworfeneEintraege } from '../../features/klaerungsliste/useVerworfeneEintraege';
import { useOutboxStatus } from '../../features/collaboration/outbox/useOutboxStatus';
import { useRejectedOutboxDialog } from '../../features/collaboration/outbox/useRejectedOutboxDialog';
import { useMatchEngineContextOptional } from '../../features/match-engine/useMatchEngineContext';
import { getEffectiveScore } from '../../utils/matchScore';
import type { SperrHinweis } from '../../core/match';
import type { LiveCockpitProps } from './types';
import { DEFAULT_MATCH_COCKPIT_SETTINGS } from '../../types/tournament';
import { ScoreboardArea } from './areas/ScoreboardArea';
import { LegacyPlayArea } from './areas/LegacyPlayArea';
import { CockpitOverlays } from './areas/CockpitOverlays';
import { ThumbBarArea } from './areas/ThumbBarArea';
import { LeerLeiste } from './areas/LeerLeiste';
import { NextMatchArea } from './areas/NextMatchArea';
import { restzeitSpielMs } from './model/restzeit';
import { mehrPunkteGrundgeruest } from './model/mehrPunkte';
import shell from './LiveCockpitShell.module.css';
import { useCockpitPhase, useSideOrder } from './hooks';
import { useCockpitStufe } from './hooks/useCockpitStufe';
import { useEntryFlows } from './hooks/useEntryFlows';
import { useEntryCommands } from './hooks/useEntryCommands';
import { useFreshEntryCommands } from './hooks/useFreshEntryCommands';
import { useSpielzeitJetzt } from './hooks/useSpielzeitJetzt';
import { useEnginePhase } from './hooks/useEnginePhase';
import { legacyPhaseViewOf } from './model/legacyPhaseView';
import { istAngepfiffenUndNichtBeendet } from './model/cockpitPhase';
import { useCockpitNotices } from './hooks/useCockpitNotices';
import { useCockpitCommands } from './hooks/useCockpitCommands';
import { useCockpitTasten } from './hooks/useCockpitTasten';
import { useTastenkuerzelAn } from './hooks/useTastenkuerzelAn';
import { useTeamColumns } from './hooks/useTeamColumns';
import { toTeamSummaryModel } from './model/toTeamSummaryModel';
import { toStrafenModel, KEINE_STRAFEN } from './model/toStrafenModel';
import { usePenaltyExpiryNotice } from './hooks/usePenaltyExpiryNotice';
import { alsUebersetzer } from './model/alsUebersetzer';
import { kastenOderStandard } from './model/kastenOderStandard';
import { hatSchonGelb as hatSchonGelbIn } from './model/secondYellow';

const NO_SPERREN: readonly SperrHinweis[] = [];
const NO_TEAMS = { home: { id: '', name: '' }, away: { id: '', name: '' } };

export const LiveCockpit: React.FC<LiveCockpitProps> = (props) => {
  const { fieldName, tournamentName, tournamentId, cockpitSettings: cockpitSettingsProp, kannSteuern, istLeitung = false, currentMatch, upcomingMatches, leer = null } = props;
  const { t } = useTranslation('cockpit');

  // W1 (Nachtrag C3a-2a): nur einbinden -- OutboxNotice rendert selbst nichts, solange kein
  // Ausgangs-Zustand vorliegt (kind === null).
  const matchEngineContext = useMatchEngineContextOptional();
  const outboxStatus = useOutboxStatus(matchEngineContext?.sender ?? null);
  const handleOutboxReload = useCallback(() => window.location.reload(), []);
  // B-50 (@HE-056, @FU-017): hat der Server Einträge dieses Geräts wegen entzogenen Rechts zur Klärung gelegt
  // B-50 Review M2: nur Spiele mit übergebenen Einträgen; Recht zurück schließt ab, Zuschauer behält die Lesesicht
  const uebergabe = useUebergabe(outboxStatus, currentMatch?.id, kannSteuern);
  const zugriffEntzogen = props.zugriffEntzogen ?? (uebergabe?.art === 'sperre' ? { uebergebeneEintraege: uebergabe.count } : null);
  // B-50 (@FU-095, B6.3): verworfene Klärungseinträge stehen im Spielprotokoll der Turnierleitung (zählen nicht)
  const verworfene = useVerworfeneEintraege(tournamentId, currentMatch, istLeitung);
  const matchMitVerlauf = useMemo(() => (currentMatch && verworfene.length > 0 ? { ...currentMatch, discardedEntries: verworfene } : currentMatch), [currentMatch, verworfene]);

  // Einstellungen mit Vorgaben, Ton für das Ende, Gerätetyp
  const cockpitSettings = useMemo(() => ({ ...DEFAULT_MATCH_COCKPIT_SETTINGS, ...cockpitSettingsProp }), [cockpitSettingsProp]);
  const sound = useMatchSound(cockpitSettings.soundId, cockpitSettings.soundVolume, cockpitSettings.soundEnabled, tournamentId);
  const { isMobile, isTablet, width } = useBreakpoint();
  const layout = width >= breakpointValues.desktop ? 'breit' : 'daumen';
  const stufe = useCockpitStufe();

  // Seiten tauschen: nur die Anzeige dieses Geräts (@SL-065)
  const sides = useSideOrder(currentMatch);
  const notices = useCockpitNotices(currentMatch?.id); // Meldezeile statt Toast (Spec § 7); endet mit dem Spielwechsel (@SL-192)

  // I4 (W1, Nachtrag Fixrunde 1): Ablehnungen (D-C1) auch für Helfer im Cockpit sichtbar.
  const rejectedOutbox = useRejectedOutboxDialog(tournamentId, notices.fehler);

  // BUG-004 FIX: Echtzeit-Uhr; hier nur noch für das Zeit-Blatt (die Tafel liest `PhaseView`, das Ende von selbst `useAutoSectionEnd`)
  const { elapsedSeconds } = useMatchTimerExtended(
    currentMatch?.timerStartTime ?? null,
    currentMatch?.timerElapsedSeconds ?? 0,
    currentMatch?.status ?? 'NOT_STARTED',
    currentMatch?.durationSeconds ?? 900, // Default 15 min if missing
    cockpitSettings.timerDirection,
    cockpitSettings.nettoWarningSeconds,
  );

  // Zustand der Tafel: Engine-Ansicht, ohne Engine-Kopie die Zeit aus dem `LiveMatch`
  const engineView = useEnginePhase(currentMatch?.id ?? '');
  const view = useMemo(
    () => engineView ?? (currentMatch ? legacyPhaseViewOf(currentMatch, elapsedSeconds) : null),
    [engineView, currentMatch, elapsedSeconds],
  );
  const phase = useCockpitPhase(currentMatch, view, currentMatch ? null : leer);
  // @SL-099 (C-COCKPIT-FOULS-NICHT-JE-HALBZEIT): Zähler gegen die Grenze je Halbzeit, Gesamtzahl nur in der Zusammenfassung; Meldung ab `foulLimit`
  const fouls = useFoulZaehler(currentMatch, view, cockpitSettings.foulLimit, (teamName, count) => { notices.melde(2, t('meldung.foulGrenze', { teamName, count })); });
  // @FU-112/@FU-115: im Spielplan beendet -- „von <Name>“ liefert der Aufrufer (nur, wenn es jemand anderes war)
  const eingetragenVon = view?.eingetragenImSpielplan ? props.eintragAutor?.(view.eingetragenImSpielplan) ?? null : null;
  // Nur im angepfiffenen Spiel: vor dem Anpfiff und ohne Spiel hat das Abzeichen keine Wirkung, der Anpfiff-Tipp gibt den Ton frei
  const tonHinweis = cockpitSettings.soundEnabled && !sound.isActivated && istAngepfiffenUndNichtBeendet(phase.zustand)
    ? { label: t('tafel.tonAusAntippen'), kurz: t('tafel.tonAus'), onAntippen: () => { void sound.activate(); } }
    : null;

  // Eintrags-Abläufe (Aufgabe 3.4): Tor zählt mit dem ersten Tipp, Nummer als Nachtrag an dieselbe Ereignis-ID
  const tx = useMemo(() => alsUebersetzer(t), [t]);
  const teams = useMemo(() => (currentMatch ? { home: currentMatch.homeTeam, away: currentMatch.awayTeam } : null), [currentMatch]);
  const frisch = useFreshEntryCommands({
    tournamentId, matchId: currentMatch?.id, teamAId: currentMatch?.homeTeam.id ?? '', teamBId: currentMatch?.awayTeam.id ?? '', melde: notices.melde, t: tx,
  });
  const matchEvents = currentMatch?.events;
  const hatSchonGelb = useCallback((teamId: string, nummer: number): boolean => hatSchonGelbIn(matchEvents ?? [], teamId, nummer), [matchEvents]);
  const flows = useEntryFlows({
    matchId: currentMatch?.id, teams: teams ?? NO_TEAMS, commands: useEntryCommands(props, frisch), spielzeitJetzt: useSpielzeitJetzt(currentMatch?.id),
    zustand: phase.zustand, melde: notices.melde, t: tx, hatSchonGelb,
  });

  const cmd = useCockpitCommands({
    props, settings: cockpitSettings, sound, flows, sides, melde: notices.melde, engineView, view,
  });
  // Tastenkürzel (@SL-153): nur am Laptop mit Steuerrecht und eingeschaltetem Schalter; `?` auch ohne Steuerrecht
  const [tastenAn] = useTastenkuerzelAn();
  const tastenAktiv = tastenAn && layout === 'breit' && kannSteuern;
  useCockpitTasten({
    aktiv: tastenAktiv, uebersichtAktiv: tastenAn && layout === 'breit', phase, kannSteuern, sides: { links: sides.links, rechts: sides.rechts },
    flows, controls: cmd.controls, onUebersicht: props.onTastenuebersicht,
  });
  const kasten = useMemo(() => kastenOderStandard(props.kasten), [props.kasten]);
  const anzeigeOrdnung = useMemo(() => ({ links: sides.links, rechts: sides.rechts }), [sides.links, sides.rechts]);
  const spalten = useTeamColumns({
    match: currentMatch, view, phase, settings: cockpitSettings, kannSteuern, fouls: fouls.halbzeit,
    sperrHinweise: props.sperrHinweise ?? NO_SPERREN, order: anzeigeOrdnung, handlers: cmd.teamHandlers, kasten, tasten: tastenAktiv,
  });
  // Nach dem Abpfiff statt der Tastenblöcke die Zusammenfassung (@SL-048); sie liest nur die Einträge des Spiels, nach dem Neuladen steht sie wieder da (@SL-115)
  const zusammenfassung = useMemo(() => {
    if (!currentMatch || phase.zustand !== 'abgepfiffen') { return null; }
    const je = (seite: 'home' | 'away') => toTeamSummaryModel({ match: currentMatch, seite, fouls: fouls.gesamt[seite], kasten: kasten[seite] });
    return { links: je(sides.links), rechts: je(sides.rechts) };
  }, [currentMatch, phase.zustand, fouls.gesamt, sides.links, sides.rechts, kasten]);
  usePenaltyExpiryNotice(currentMatch?.id, view, teams, notices.melde, tx);
  // Laufende Zeitstrafen als Karten am Laptop (@SL-186): Dauer und Beginn kommen aus der Engine-Ansicht
  const strafen = useMemo(() => (currentMatch ? toStrafenModel(view?.penalties, currentMatch, kasten) : KEINE_STRAFEN), [currentMatch, view, kasten]);

  // Tafel: mit Spiel und ohne (wartet auf Teams, kein Spiel mehr). Die Verbindungsanzeige steht bis zum schmalen Kopf (3.8) darin.
  const tafel = (
    <ScoreboardArea
      match={currentMatch}
      phase={phase}
      view={view}
      settings={cockpitSettings}
      order={{ links: sides.links, rechts: sides.rechts }}
      kasten={kasten}
      size={isMobile ? 'compact' : isTablet ? 'regular' : 'wide'}
      stufe={layout === 'breit' ? stufe : undefined}
      notices={notices}
      eintraegeWarten={rejectedOutbox.pendingCount}
      tonHinweis={tonHinweis}
      fieldName={fieldName}
      tournamentName={tournamentName}
      leer={leer}
      mindestpause={props.mindestpause}
      sperrHinweise={props.sperrHinweise}
      uebernahmeVon={props.uebernahmeVon}
      eingetragenVon={eingetragenVon}
      // A4 (C-SYNC): rendert selbst nichts außerhalb des Cloud-Modus. I4 (W1, Nachtrag
      // Fixrunde 1): rejectedCount/reviewCount aus dem echten Sender (useEngineOutboxSummary).
      sync={
        <SyncStatusIndicator
          tournamentId={tournamentId}
          compact
          rejectedCount={rejectedOutbox.rejectedCount}
          reviewCount={rejectedOutbox.reviewCount}
          onShowRejected={rejectedOutbox.show}
          enginePendingCount={rejectedOutbox.pendingCount}
        />
      }
    />
  );

  if (zugriffEntzogen) {
    return <div className={shell.empty} data-testid="cockpit-zugriff-entzogen"><p className={shell.emptyText}>{t('leiste.keinZugriff', { count: zugriffEntzogen.uebergebeneEintraege })}</p></div>;
  }
  if (!currentMatch) {
    if (leer) {
      return (
        <div className={shell.container} data-layout={layout} data-stufe={layout === 'breit' ? stufe : undefined} data-testid="live-cockpit">
          <main className={isMobile ? `${shell.content} ${shell.contentMobile}` : shell.content}>{tafel}</main>
          {leer.art === 'wartetAufHerkunft' && (
            <LeerLeiste
              phase={phase} layout={layout} kannSteuern={kannSteuern} istLeitung={istLeitung} fieldName={fieldName}
              steuerung={props.steuerung} cmd={cmd} settings={cockpitSettings} tournamentId={tournamentId}
            />
          )}
        </div>
      );
    }
    return (
      <div className={shell.empty}>
        <p className={shell.emptyText}>{t('leer.keinSpielGewaehlt')}</p>
      </div>
    );
  }

  const match = matchMitVerlauf ?? currentMatch;
  if (!spalten) { return null; } // nie: ohne Spiel (spalten === null) kehrt die Hülle oben zurück
  // Task R2: `kannSteuern` kommt aus einer echten Berechtigungsprüfung (ManagementTab, `useCan('writeMatchData')`), das
  // beendete Spiel ist die bestehende "Spiel ist vorbei"-Sperre. Beide führen zu "keine Bedienung", aber nur das
  // fehlende Recht zeigt das Berechtigungs-Banner.
  const readOnly = !kannSteuern;
  const isLocked = readOnly || match.status === 'FINISHED';
  const effectiveScore = getEffectiveScore(match);

  return (
    <div className={shell.container} data-layout={layout} data-stufe={layout === 'breit' ? stufe : undefined} data-testid="live-cockpit">
      <main className={isMobile ? `${shell.content} ${shell.contentMobile}` : shell.content}>
        <LegacyPlayArea
          kopf={(
            <>
              {tafel}
              {/* @FU-109: Statuszeile im normalen Fluss unter der Anzeigetafel (Review Version-Fix R1) */}
              <AwaitingServerCopyLine tournamentId={tournamentId} />
              {/* Task R2: Read-Only-Banner — nur bei fehlender Berechtigung, nicht bei beendetem Spiel und nicht bei fremd gesteuertem Feld (B-49: Zeile in der Leiste). */}
              {readOnly && !props.steuerung && (
                <div className={shell.readOnlyBanner} data-testid="cockpit-readonly-banner" role="status">
                  {t('readOnly.banner')}
                </div>
              )}
              {/* W1 (Nachtrag C3a-2a): rendert selbst nichts, solange kein Ausgangs-Zustand vorliegt. */}
              <OutboxNotice status={outboxStatus} matchId={match.id} onReload={handleOutboxReload} />
              {uebergabe?.art === 'zusehen' && <p className={shell.readOnlyBanner} data-testid="cockpit-uebergeben-zusehen" role="status">{t('leiste.nurZusehen', { count: uebergabe.count })}</p>}
            </>
          )}
          match={match}
          naechstes={<NextMatchArea naechstes={upcomingMatches.length > 0 ? upcomingMatches[0] : null} phase={phase} restSpielMs={view ? restzeitSpielMs(view) : null} layout={layout} />}
          isMobile={isMobile}
          isDesktop={layout === 'breit'}
          zustand={phase.zustand}
          strafstossForm={props.strafstossForm}
          columns={spalten}
          zusammenfassung={zusammenfassung}
          sidebar={{ strafen, onEventEdit: cmd.onSidebarEventEdit }}
        />
      </main>

      <ThumbBarArea
        phase={phase}
        layout={layout}
        kannSteuern={kannSteuern}
        istLeitung={istLeitung}
        abgeschlossen={props.abgeschlossen}
        fieldName={fieldName}
        steuerung={props.steuerung}
        controls={cmd.controls}
        tastenAn={tastenAktiv}
        onWeiterNaechstes={() => { props.onLoadNextMatch(match.fieldId); }}
        onKorrigieren={props.onKorrigieren ? () => { props.onKorrigieren?.(match.id); } : undefined}
        onChooseTiebreak={props.onChooseTiebreak ? (wahl) => { props.onChooseTiebreak?.(match.id, wahl); } : undefined}
      />

      <CockpitOverlays
        match={match}
        tournamentId={tournamentId}
        readOnly={readOnly}
        isLocked={isLocked}
        settings={cockpitSettings}
        effectiveScore={effectiveScore}
        dialogs={cmd.dialogs}
        editingEvent={cmd.editingEvent}
        editing={cmd.editing}
        handlers={cmd.overlayHandlers}
        rejectedOutbox={rejectedOutbox}
        mehr={{
          punkte: mehrPunkteGrundgeruest(phase, { kannSteuern, istLeitung: istLeitung && props.onNichtAngetreten !== undefined }),
          aktionen: { ...cmd.mehrAktionen, nichtAngetreten: () => { props.onNichtAngetreten?.(match.id); } },
        }}
        entrySheets={{ flows, teams: teams ?? NO_TEAMS, ausloeserSeite: (seite) => (sides.links === seite ? 'links' : 'rechts'), kartenArten: cockpitSettings.enabledCards, t: tx }}
      />
    </div>
  );
};

export default LiveCockpit;
