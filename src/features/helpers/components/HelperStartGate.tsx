/**
 * Start der App auf einem Helfer-Gerät (A-17c; @HE-096, @HE-098, @HE-099, @HE-109, @HE-028): „Die App öffnet direkt, was gerade
 * läuft; laufen mehrere, fragt sie.“ Wer einen Helfer-Zugang auf dem Gerät hat und die Adresse der App öffnet, kommt direkt an
 * sein Feld (oder zur Auswahl, oder zur Endkarte) – ohne Startseite, ohne neuen Scan und ohne Zwischenfrage. Läuft nichts,
 * steht die Startseite mit der Einsatz-Karte. Geräte ohne Zugangs-Index sehen die Startseite sofort, ohne Verzögerung und ohne Netzaufruf.
 * Die Entscheidung trifft `decideHelperStart`; hier wird nur geladen, kurz „Zugang wird geprüft …“ gezeigt und navigiert.
 * Nur beim ersten Öffnen je Seitenaufruf. Wer von Feld, Auswahl oder Endkarte bewusst zur Startseite geht („Meine Turniere auf diesem
 * Handy“, „Zur Startseite“), setzt vorher den Merker (`markHelperStartHandled`), damit die Weiche ihn nicht zurückleitet (@HE-110).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { captureFeatureError } from '../../../lib/sentry';
import { hasStoredHelperAccessIndex } from '../helperAccessStore';
import { decideHelperStart } from '../helperStartTarget';
import { isRunningOwnTournament } from '../runningState';
import type { Tournament } from '../../../types/tournament';
import { HelperAssignmentCards } from './HelperAssignmentCards';
import { loadHelperStartContext, type HelperStartContextDeps } from '../helperStartContext';
import { defaultHelperStartDeps, isHelperStartHandled, markHelperStartHandled } from '../helperStartDeps';
import { helperFieldPath, helperTournamentPath, HELPER_CHOOSER_PATH, HELPER_JOIN_PATH_PREFIX } from '../joinPaths';
import { JoinShell } from './JoinShell';

export interface HelperStartGateProps {
  /** Nur die Startseite `/` leitet weiter (nicht Archiv und Papierkorb). */
  active: boolean;
  /** Lokale Turniere des Geräts (eigene laufende zählen mit, @HE-099). */
  tournaments: readonly Tournament[];
  children: ReactNode;
  /** Nur für Tests. */
  deps?: HelperStartContextDeps;
}

export const HelperStartGate = ({ active, tournaments, children, deps }: HelperStartGateProps) => {
  const { t } = useTranslation('helpers');
  const navigate = useNavigate();
  const [checking, setChecking] = useState(() => active && !isHelperStartHandled() && hasStoredHelperAccessIndex());
  const tournamentsRef = useRef(tournaments);
  useEffect(() => { tournamentsRef.current = tournaments; }, [tournaments]);

  useEffect(() => {
    if (!checking) {
      markHelperStartHandled();
      return undefined;
    }
    let cancelled = false;
    void (async () => {
      let target = decideHelperStart({ sessionKind: 'none', entries: [] });
      try {
        const context = await loadHelperStartContext(deps ?? defaultHelperStartDeps());
        const known = new Set(context.entries.map((entry) => entry.tournamentId));
        const own = tournamentsRef.current.filter((tournament) => !known.has(tournament.id) && !tournament.deletedAt);
        const now = new Date();
        target = decideHelperStart({
          sessionKind: context.session.kind,
          entries: context.entries,
          ownRunningIds: own.filter((tournament) => isRunningOwnTournament(tournament, now)).map((tournament) => tournament.id),
          hasOwnTournaments: own.length > 0,
          now,
        });
      } catch (error) {
        if (error instanceof Error) {
          captureFeatureError(error, 'helpers', 'startGate');
        }
      }
      if (cancelled) {
        return;
      }
      markHelperStartHandled();
      switch (target.kind) {
        case 'field':
          void navigate(helperFieldPath(target.tournamentId, target.field), { replace: true });
          return;
        case 'own':
          void navigate(helperTournamentPath(target.tournamentId), { replace: true });
          return;
        case 'chooser':
          void navigate(HELPER_CHOOSER_PATH, { replace: true });
          return;
        case 'join':
          void navigate(`${HELPER_JOIN_PATH_PREFIX}${encodeURIComponent(target.code)}`, { replace: true });
          return;
        case 'stay':
          setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [checking, deps, navigate]);

  if (checking) {
    return (
      <JoinShell>
        <p role="status" aria-busy="true" data-testid="helper-start-checking">{t('join.chooser.checking')}</p>
      </JoinShell>
    );
  }
  return (
    <>
      {active && <HelperAssignmentCards deps={deps} />}
      {children}
    </>
  );
};
