/**
 * ManagementTab - Turnierleitung (Kampfgericht)
 *
 * Live-Spielverwaltung mit LiveCockpit:
 * - Timer-Management für jedes Spiel
 * - Live-Torzählung mit Event-Tracking
 * - Speicherung in tournament.matches
 * - Persistierung in localStorage
 * - Match-Selektor für flexible Auswahl
 * - Zeit-Editor für manuelle Anpassungen
 */

import { useTournamentClosed } from '../../hooks/useTournamentClosed';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_MATCH_COCKPIT_SETTINGS, Tournament } from '../../types/tournament';
import { GeneratedSchedule, ScheduledMatch } from '../../core/generators';
import { KLAERUNG_IM_COCKPIT_KOPF, KlaerungslisteEinstieg } from '../klaerungsliste/KlaerungslisteEinstieg';
import { LiveCockpit } from '../../components/live-cockpit';
import { ShortcutHelp } from '../../components/live-cockpit/areas/ShortcutHelp';
import type { MatchSummary } from '../../components/live-cockpit/types';
import { useCockpitExecution } from '../../hooks/useCockpitExecution';
import { useCockpitLeerGrund } from './hooks/useCockpitLeerGrund';
import { useCan } from '../auth/hooks/useCan';
import { useEventAuthors } from '../match-engine/useEventAuthors';
import { useToast } from '../../components/ui/Toast';
import { ScheduleForfeitPrompt } from './components/ScheduleForfeitPrompt';
import { useScheduleForfeit } from './hooks/useScheduleForfeit';
import { RulesLockProvider } from '../../components/match-settings/RulesLockContext';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { buildSideContext } from '../../components/schedule/matchSides';
import { useFieldMatchSelection } from './hooks/useFieldMatchSelection';
import { useEngineMatchInit } from './hooks/useEngineMatchInit';
import { useCockpitKorrektur } from './hooks/useCockpitKorrektur';
import { laeuftAufFeld, useCockpitFieldControl } from './hooks/useCockpitFieldControl';
import { toMatchSummary } from './model/toMatchSummary';
import { toCockpitBoxes } from './model/toCockpitBoxes';
import { CockpitSlimHeader } from '../../components/live-cockpit/frame/CockpitSlimHeader';
import { StorageWarningBanner } from '../../components/StorageWarningBanner';
import { FeldWahl } from '../../components/live-cockpit/frame/FeldWahl';
import { ConnectionPill } from '../../components/live-cockpit/frame/ConnectionPill';
import { useAnnounceCockpitFrame, istCockpitVollbild } from '../../components/live-cockpit/frame/cockpitFrame';
import styles from './ManagementTab.module.css';

interface ManagementTabProps {
  tournament: Tournament;
  schedule: GeneratedSchedule;
  onTournamentUpdate: (tournament: Tournament, regenerateSchedule?: boolean) => void;
  /**
   * Task A1 (Sofortschutz): NUR lokales State-Update, KEIN Speicherpfad — siehe
   * `UseMatchExecutionProps.onLocalTournamentUpdate`. Von `onTournamentUpdate` oben getrennt,
   * weil `handleUpdateSettings` unten weiterhin echt speichern muss (Turnier-Einstellungen).
   */
  onLocalTournamentUpdate: (tournament: Tournament) => void;
  /** Initial match ID to select (from schedule navigation) */
  initialMatchId?: string | null;
  /** Callback when initial match has been consumed */
  onInitialMatchConsumed?: () => void;
}

export const ManagementTab: React.FC<ManagementTabProps> = ({
  tournament,
  schedule,
  onTournamentUpdate,
  initialMatchId,
  onInitialMatchConsumed,
}) => {
  const { t } = useTranslation('tournament');
  const { t: tCommon } = useTranslation('common');
  const { t: tCockpit } = useTranslation('cockpit');
  const { isOnline } = useOnlineStatus();

  // A-08a: Cockpit nur über Engine-Ereignisse (kein Altservice, kein Altweg)
  const {
    liveMatches,
    getLiveMatchData,
    handleStart: hookHandleStart,
    handlePause,
    handleResume,
    handleFinish,
    handleGoal,
    handleTimePenalty,
    handleCard,
    handleSubstitution,
    handleFoul,
  } = useCockpitExecution(tournament);

  // A-11 (useCan): Spielregeln (@W2A-030) = tournamentSettings; Spielbetrieb im Cockpit = writeMatchData. Ohne bekannte
  // Rolle entscheidet useCan (Gedächtnis, sonst L7: Spielbetrieb offen) -- „ohne Mitgliedszeile erlaubt“ entfällt.
  const [tastenHilfe, setTastenHilfe] = useState(false); // Übersicht der Tastenkürzel: Knopf im Kopf und Taste `?` (@SL-153)
  const canChangeRules = useCan('tournamentSettings', tournament.id);
  const canPlay = useCan('writeMatchData', tournament.id);
  // Turnierleitung (@SL-159): nur sie bekommt „Korrigieren“, der Helfer den Hinweis „Korrektur über die Turnierleitung“ (@SL-045)
  const istLeitung = useCan('leadMatches', tournament.id);
  const closed = useTournamentClosed(tournament.id); // R3-3: Cockpit nennt den Abschluss statt des Helfer-Satzes
  const { feld, setFeld, fieldMatches, currentMatchData, waehleSpiel, ladeNaechstes, endstandPause } = useFieldMatchSelection({
    numberOfFields: tournament.numberOfFields, schedule, liveMatches, initialMatchId, onInitialMatchConsumed,
  });
  // „Korrigieren“ nach dem Abpfiff (@SL-159): nur die Turnierleitung bekommt den Weg, derselbe wie die Korrektur im Spielplan;
  // solange er offen ist, pausiert der Countdown des Endstands (@SL-163, @SL-164)
  const korrektur = useCockpitKorrektur(tournament, liveMatches, istLeitung, { onBeginn: endstandPause.pausiere, onEnde: endstandPause.setzeFort });

  // B-12 (@SL-174): „Nicht angetreten“ unter „Mehr“ öffnet denselben Dialog wie der Spielplan (nur Turnierleitung, vor dem Anpfiff)
  const { showWarning, showSuccess } = useToast();
  const forfeit = useScheduleForfeit({ tournament, showWarning: (message) => { showWarning(message); }, showSuccess: (message) => { showSuccess(message); } });

  // Spielseiten: Team über die Team-ID, offene Seite über ihre Herkunft (@TM-015) – nie über gespeicherte Namen
  const sides = useMemo(
    () => buildSideContext(
      { teams: tournament.teams, groups: tournament.groups, matches: schedule.allMatches },
    ),
    [tournament.teams, tournament.groups, schedule.allMatches],
  );

  // ScheduledMatch als MatchSummary (mit den getragenen Farben, @SL-160)
  const toSummary = useCallback((sm: ScheduledMatch): MatchSummary => toMatchSummary(sm, { tournament, sides, t }), [tournament, sides, t]);

  const { isInitializingMatch, engineReadyError, awaitingTeams, notOnEngineReason, handleRetryEngineReady } = useEngineMatchInit({ currentMatchData, liveMatches, getLiveMatchData });

  // Current match as LiveMatch (derived from state)
  const { nameOf, ownName } = useEventAuthors(tournament.id, currentMatchData?.id ?? '');
  // @FU-115: „Ende – eingetragen im Spielplan von Olli“ -- der Name nur, wenn ein anderes Konto beendet hat
  const eintragAutor = useCallback((eventId: string): string | null => {
    const name = nameOf(eventId);
    return name !== ownName ? name : null;
  }, [nameOf, ownName]);
  // @SL-176: Kästen wie am Hallenmonitor (getragene Farbe, Einstellung „Teamfarben in den Ergebniskästen“)
  const kasten = useMemo(() => toCockpitBoxes(tournament, currentMatchData?.id), [tournament, currentMatchData?.id]);
  const currentMatch = useMemo(() =>
    currentMatchData ? liveMatches.get(currentMatchData.id) ?? null : null,
    [currentMatchData, liveMatches]
  );
  // B-49: Steuer je Feld – fremd gesteuertes Feld nur lesend, „Spielleitung übernehmen“, Halter in der Feldwahl (@FU-026, @FU-027, @HE-049)
  const feldLaeuft = useMemo(() => laeuftAufFeld(fieldMatches.map((m) => m.id), liveMatches, tournament.matches), [fieldMatches, liveMatches, tournament.matches]);
  const steuer = useCockpitFieldControl({
    tournamentId: tournament.id, feld, feldName: t('management.field', { number: feld }), canPlay, istLeitung, feldLaeuft, currentMatch,
  });

  // Find last finished match
  const lastFinishedMatchData = useMemo(() => {
    const finishedMatches = fieldMatches.filter((m) =>
      m.scoreA !== undefined && m.scoreB !== undefined
    ) as (ScheduledMatch & { scoreA: number; scoreB: number })[];
    return finishedMatches[finishedMatches.length - 1];
  }, [fieldMatches]);

  const lastFinishedMatch = useMemo(() =>
     
    lastFinishedMatchData ? {
      match: toSummary(lastFinishedMatchData),
      homeScore: lastFinishedMatchData.scoreA,
      awayScore: lastFinishedMatchData.scoreB,
    } : null,
    [lastFinishedMatchData, toSummary]
  );

  // Upcoming matches (matches after current)
  const upcomingMatches = useMemo(() => {
    const currentIndex = fieldMatches.findIndex((m) => m.id === currentMatchData?.id);
    return currentIndex !== -1
      ? fieldMatches.slice(currentIndex + 1).map(toSummary)
      : fieldMatches.map(toSummary);
  }, [fieldMatches, currentMatchData, toSummary]);

  const handleFinishAndReset = useCallback((matchId: string): Promise<string | null> => handleFinish(matchId).then((eventId) => {
    setTimeout(() => { waehleSpiel(null); }, 0);
    return eventId;
  }), [handleFinish, waehleSpiel]);

  const handleUpdateSettings = useCallback(async (settings: import('../../types/tournament').MatchCockpitSettings) => {
    // @W2A-030: Regelfelder speichert nur die Turnierleitung. Alle anderen behalten den
    // gespeicherten Stand, auch wenn die Eingabe im Dialog etwas anderes sagt.
    const gespeichert = tournament.matchCockpitSettings ?? DEFAULT_MATCH_COCKPIT_SETTINGS;
    const erlaubt = canChangeRules
      ? settings
      : {
          ...settings,
          timePenaltyDurationSeconds: gespeichert.timePenaltyDurationSeconds,
          penaltyShootersPerTeam: gespeichert.penaltyShootersPerTeam,
        };
    // Merge with existing tournament settings
    const updatedTournament = {
      ...tournament,
      matchCockpitSettings: erlaubt,
    };
    // Persist
    onTournamentUpdate(updatedTournament);
  }, [tournament, onTournamentUpdate, canChangeRules]);

  // A-08d2b (B1): Ereignisse kommen vom Engine-Weg bereits im Laufzeitformat (teamId) -- keine
  // Umrechnung mehr an der Prop-Grenze. Das Cockpit bekommt das Match unveraendert.

  // Kein Spiel im Cockpit: die Tafel nennt den Grund (@SL-052, @SL-054); Sperr-Hinweise nach Rot (@SL-089)
  const { leer, sperrHinweise, leerProps } = useCockpitLeerGrund({
    tournament, allMatches: schedule.allMatches, currentMatchData, awaitingTeams, isOnline, sides, selectedFieldNumber: feld,
    upcomingMatches, onLoadNextMatch: ladeNaechstes, istLeitung,
  });

  // A1/K6: schmaler Kopf, sobald das Feld ein Spiel hat oder auf Teams wartet – auch beim Laden und Vorbereiten (der Kopf springt nicht)
  const vollbild = istCockpitVollbild(leer?.art ?? 'vorAnpfiff');
  useAnnounceCockpitFrame(vollbild);

  return (
    <div className={vollbild ? `${styles.container} ${styles.containerVollbild}` : styles.container} data-testid="management-tab">
      {vollbild && (
        <CockpitSlimHeader
          tournamentId={tournament.id} turnierName={tournament.title} felder={tournament.numberOfFields} feld={feld} onFeld={setFeld} halter={steuer.halter}
          verbindung={<ConnectionPill tournamentId={tournament.id} />} onTastenkuerzel={() => setTastenHilfe(true)}
          klaerung={KLAERUNG_IM_COCKPIT_KOPF ? <KlaerungslisteEinstieg tournament={tournament} variant="cockpit" /> : undefined}
        />
      )}
      {/* Speicher-Warnung im Rahmen: im Fluss unter dem Kopf, damit sie nicht verloren geht (die feste Leiste der Hülle entfällt hier) */}
      {vollbild && <StorageWarningBanner imFluss />}

      {/* LIVE COCKPIT */}
      {currentMatch ? (
        <RulesLockProvider value={!canChangeRules}>
          <LiveCockpit
            fieldName={t('management.field', { number: feld })}
            tournamentName={tournament.title}
            tournamentId={tournament.id}
            cockpitSettings={tournament.matchCockpitSettings}
            kannSteuern={steuer.kannSteuern}
            steuerung={steuer.steuerung}
            uebernahmeVon={steuer.uebernahmeVon}
            istLeitung={istLeitung}
            abgeschlossen={closed}
            onKorrigieren={korrektur.onKorrigieren}
            onNichtAngetreten={istLeitung ? (matchId) => { void forfeit.markForfeit(matchId); } : undefined}
            currentMatch={currentMatch}
            kasten={kasten}
            onTastenuebersicht={() => setTastenHilfe(true)}
            sperrHinweise={sperrHinweise}
            eintragAutor={eintragAutor}
            lastFinishedMatch={lastFinishedMatch}
            upcomingMatches={upcomingMatches}
            onStart={(matchId) => { void hookHandleStart(matchId); }}
            onPause={(matchId) => { void handlePause(matchId); }}
            onResume={(matchId) => { void handleResume(matchId); }}
            onFinish={handleFinishAndReset}
            onGoal={(matchId, teamId, delta, options) => handleGoal(matchId, teamId, delta, options)}
            // A-08c (@FU-071): Undo, Direkteintrag, Zeit, Wiedereröffnen, K.-o.-/Strafstoß-Handler und
            // Ereignis-Bearbeiten/-Löschen haben keinen Engine-Weg und werden NICHT übergeben
            // -- das Cockpit blendet die zugehörigen Knöpfe aus.
            onLoadNextMatch={ladeNaechstes}
            // Event tracking callbacks
            onTimePenalty={(matchId, teamId, options) => { void handleTimePenalty(matchId, teamId, options); }}
            onCard={(matchId, teamId, type, options) => { void handleCard(matchId, teamId, type, options); }}
            onSubstitution={(matchId, teamId, options) => { void handleSubstitution(matchId, teamId, options); }}
            onFoul={(matchId, teamId) => { void handleFoul(matchId, teamId); }}
            onUpdateSettings={(settings) => { void handleUpdateSettings(settings); }}
          />
        </RulesLockProvider>
      ) : leer?.art === 'wartetAufHerkunft' ? (
        <LiveCockpit {...leerProps} />
      ) : isInitializingMatch ? (
        <div className={styles.noMatches}>
          {t('management.matchLoading')}
        </div>
      ) : notOnEngineReason ? (
        <div className={styles.noMatches} data-testid="cockpit-not-on-engine">
          {/* @SL-159: „Korrektur über die Turnierleitung“ gilt nur für Helfer; die Turnierleitung korrigiert im Spielplan (R3-4) */}
          {notOnEngineReason === 'resultEntered'
            ? (istLeitung ? t('management.resultEnteredLead') : tCockpit('engine.retract.hint.goalFinished'))
            : t('filter.status.skipped')}
        </div>
      ) : engineReadyError ? (
        <div className={styles.noMatches}>
          {t('management.enginePreparing')}
          <div><button type="button" className={styles.retryButton} data-testid="engine-ready-retry" onClick={handleRetryEngineReady}>{tCommon('actions.retry')}</button></div>
        </div>
      ) : leer?.art === 'keinSpiel' ? (
        <>
          {/* Ohne Spiel auf dem Feld gibt es keinen schmalen Kopf: die Feldwahl steht über der Tafel (Zone 1, @OB-030) */}
          {tournament.numberOfFields > 1 && <div className={styles.feldwahlLeer}><FeldWahl felder={tournament.numberOfFields} feld={feld} onFeld={setFeld} halter={steuer.halter} /></div>}
          <LiveCockpit {...leerProps} />
        </>
      ) : (
        <div className={styles.noMatches}>
          {t('management.noMatchesOnField')}
        </div>
      )}

      <ScheduleForfeitPrompt prompt={forfeit.prompt} answerPrompt={forfeit.answerPrompt} />

      {/* Korrektur nach dem Abpfiff: Ergebnis, dann Grund (@SL-159) */}
      <ShortcutHelp isOpen={tastenHilfe} onClose={() => setTastenHilfe(false)} />
      {korrektur.dialoge}
      {steuer.dialog}
    </div>
  );
};
