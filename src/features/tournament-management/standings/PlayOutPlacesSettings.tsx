/**
 * Einstellung „Diese Plätze müssen bei Gleichstand ausgespielt werden“ in den Einstellungen der Turnierverwaltung (Paket TB-B,
 * TB-6d'; Mockup v3 Zustand 3; @W2A-068, K15). Die Einstellung bleibt jederzeit änderbar (Daniel 20.10.). Hebt die Änderung
 * eine Annahme „Ergebnis so akzeptieren“ auf, fragt die App vor dem Speichern und nennt die betroffenen Teams; ein
 * eingetragenes Strafstoßschießen oder eine festgelegte Reihenfolge bleibt bei jeder Änderung bestehen. Ziel des Sprungs
 * „Turnierregeln ansehen“ aus dem Entscheidungs-Dialog (`?abschnitt=gleichstand`, gelesen in der Verwaltung). Rechte: `tournamentSettings`.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CSSProperties } from 'react';
import { cssVars, dialogWidths } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import { DialogActions } from '../../../components/ui/molecules/DialogActions';
import { DialogSurface } from '../../../components/ui/molecules/DialogSurface';
import { InlineNotice } from '../../../components/ui/molecules/InlineNotice';
import { effectivePlacementsToPlayOut, offeredPlaces } from '../../../core/standings/playOutPlaces';
import { placesChangeEffects } from '../../../core/standings/tieViews';
import type { Tournament } from '../../../types/tournament';
import type { PlayOutPlacesError, PlayOutPlacesResult } from '../../../core/services/PlayOutPlacesService';
import { useCan } from '../../auth/hooks/useCan';
import { PlayOutPlacesField } from '../../tournament-creation/components/PlayOutPlacesSection';
import { listText } from './tieFormat';

export interface PlayOutPlacesSettingsProps {
  tournament: Tournament;
  /** Schmaler Speicherweg (`PlayOutPlacesService`): nur die Einstellung, mit Versionsprüfung; nie das ganze Turnier. */
  onSave: (places: number[]) => Promise<PlayOutPlacesResult>;
  /** Aufruf mit `?abschnitt=gleichstand` (Sprung „Turnierregeln ansehen“): Abschnitt ins Bild holen. Die Adresse liest die Verwaltung. */
  jumpHere?: boolean;
}

const line: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.md, lineHeight: cssVars.lineHeights.bodyMd, color: cssVars.colors.textPrimary };

export const PlayOutPlacesSettings = ({ tournament, onSave, jumpHere = false }: PlayOutPlacesSettingsProps) => {
  const { t, i18n } = useTranslation('tournament');
  const canChange = useCan('tournamentSettings', tournament.id);
  const anchor = useRef<HTMLDivElement>(null);
  const offered = useMemo(() => offeredPlaces(tournament.teams), [tournament.teams]);
  const saved = useMemo(() => effectivePlacementsToPlayOut(tournament), [tournament]);
  const savedKey = saved.join(',');
  const [draft, setDraft] = useState<number[]>(saved);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<PlayOutPlacesError | 'UNKNOWN' | null>(null);
  const [busy, setBusy] = useState(false);
  const dirty = draft.join(',') !== savedKey;

  // nach dem Speichern (oder einer Änderung von außen) zeigt die Auswahl wieder den gespeicherten Stand
  useEffect(() => { setDraft(saved); }, [savedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sprung aus dem Entscheidungs-Dialog („Turnierregeln ansehen“): Abschnitt ins Bild holen
  useEffect(() => {
    if (jumpHere) {
      anchor.current?.scrollIntoView?.({ block: 'start' });
      anchor.current?.focus();
    }
  }, [jumpHere]);

  const effects = useMemo(() => (dirty ? placesChangeEffects(tournament, draft) : { lost: [] }), [dirty, tournament, draft]);
  const nameOf = (teamId: string): string => tournament.teams.find((team) => team.id === teamId)?.name ?? '';

  const commit = async (): Promise<void> => {
    setConfirming(false);
    setError(null);
    setBusy(true);
    try {
      const result = await onSave(draft);
      if (!result.ok) {
        setError(result.code); // sichtbar, nie still überschrieben
      }
    } catch {
      setError('UNKNOWN'); // Netz- oder Serverfehler trotz „online“: nie still
    } finally {
      setBusy(false);
    }
  };
  const save = (): void => {
    if (effects.lost.length > 0) {
      setConfirming(true);
    } else {
      void commit();
    }
  };

  return (
    <div ref={anchor} tabIndex={-1} id="gleichstand-regeln" data-testid="playout-settings" style={{ outline: 'none', marginTop: cssVars.spacing.xl }}>
      <PlayOutPlacesField offered={offered} value={draft} onChange={setDraft} disabled={!canChange} />
      {canChange ? (
        <div style={{ display: 'flex', gap: cssVars.spacing.sm, flexWrap: 'wrap', marginTop: cssVars.spacing.md }}>
          <Button variant="primary" size="lg" disabled={!dirty || busy} onClick={save} data-testid="playout-save" style={{ minHeight: cssVars.touchTargets.primary }}>{t('standingsTie.settings.save')}</Button>
          <Button variant="secondary" size="lg" disabled={!dirty} onClick={() => setDraft(saved)} data-testid="playout-reset" style={{ minHeight: cssVars.touchTargets.primary }}>{t('standingsTie.settings.reset')}</Button>
        </div>
      ) : (
        <p style={{ ...line, marginTop: cssVars.spacing.md, color: cssVars.colors.textSecondary }} data-testid="playout-readonly">{t('standingsTie.settings.readOnly')}</p>
      )}
      {error !== null ? (
        <div style={{ marginTop: cssVars.spacing.md }}>
          <InlineNotice tone="error" data-testid="playout-error"><span>{t(`standingsTie.settings.errors.${error}`)}</span></InlineNotice>
        </div>
      ) : null}
      <DialogSurface isOpen={confirming} onClose={() => setConfirming(false)} labelledBy="playout-confirm-title" testId="tie-places-confirm" maxWidth={dialogWidths.md}>
        <div style={{ display: 'grid', gap: cssVars.spacing.md, padding: cssVars.spacing.md }}>
          <h2 id="playout-confirm-title" style={{ margin: 0, fontSize: cssVars.fontSizes.xl, lineHeight: cssVars.lineHeights.title }}>{t('standingsTie.settings.confirmTitle')}</h2>
          <p style={line}>{t('standingsTie.settings.confirmIntro')}</p>
          <InlineNotice tone="info" data-testid="playout-confirm-effect">
            {effects.lost.map((decision) => (
              <span key={decision.id}>{t('standingsTie.settings.confirmBody', { names: listText(decision.teamIds.map(nameOf), i18n.language) })}</span>
            ))}
          </InlineNotice>
          <p style={{ ...line, color: cssVars.colors.textSecondary }}>{t('standingsTie.settings.confirmKeep')}</p>
          <DialogActions
            secondary={[{ label: t('standingsTie.settings.confirmCancel'), onClick: () => setConfirming(false), 'data-testid': 'playout-confirm-cancel' }]}
            primary={{ label: t('standingsTie.settings.confirmOk'), onClick: () => { void commit(); }, 'data-testid': 'playout-confirm-ok' }}
          />
        </div>
      </DialogSurface>
    </div>
  );
};
