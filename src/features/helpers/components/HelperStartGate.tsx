/**
 * Start der App auf einem Helfer-Gerät (A-17c; @HE-096, @HE-098, @HE-099, @HE-028): Wer einen Helfer-Zugang auf dem Gerät hat
 * und die Adresse der App öffnet, kommt direkt an sein Feld (oder zur Auswahl, oder zur Endkarte) – ohne Startseite und ohne
 * neuen Scan. Geräte ohne Zugangs-Index sehen die Startseite sofort, ohne Verzögerung und ohne Netzaufruf.
 * Die Entscheidung trifft `decideHelperStart`; hier wird nur geladen, kurz „Zugang wird geprüft …“ gezeigt und navigiert.
 * Nur beim ersten Öffnen je Seitenaufruf: „Zur Startseite“ führt danach nicht wieder zurück ans Feld.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { captureFeatureError } from '../../../lib/sentry';
import { hasStoredHelperAccessIndex } from '../helperAccessStore';
import { decideHelperStart } from '../helperStartTarget';
import { loadHelperStartContext, type HelperStartContextDeps } from '../helperStartContext';
import { defaultHelperStartDeps, isHelperStartHandled, markHelperStartHandled } from '../helperStartDeps';
import { helperFieldPath, HELPER_CHOOSER_PATH, HELPER_JOIN_PATH_PREFIX } from '../joinPaths';
import { JoinShell } from './JoinShell';

export interface HelperStartGateProps {
  /** Nur die Startseite `/` leitet weiter (nicht Archiv und Papierkorb). */
  active: boolean;
  /** Lokale Turniere des Geräts (Gast-Turniere bleiben sichtbar). */
  tournaments: ReadonlyArray<{ id: string }>;
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
      let target = decideHelperStart({ sessionKind: 'none', entries: [], hasOtherTournaments: false });
      try {
        const context = await loadHelperStartContext(deps ?? defaultHelperStartDeps());
        const known = new Set(context.entries.map((entry) => entry.tournamentId));
        const hasOtherTournaments = tournamentsRef.current.some((tournament) => !known.has(tournament.id));
        target = decideHelperStart({ sessionKind: context.session.kind, entries: context.entries, hasOtherTournaments });
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
  return <>{children}</>;
};
