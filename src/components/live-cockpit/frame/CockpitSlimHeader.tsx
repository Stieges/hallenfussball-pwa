/**
 * CockpitSlimHeader – schmaler Kopf im Live-Bereich (Plan LT-2, Entscheidung A1, @SL-140, Mockup laptop.html).
 *
 * „Zurück“ · Turniername · Feldwahl „Feld 1 ▾“ (nur bei mehr als einem Feld, Name „Feld wählen, jetzt Feld 1“) · Leerraum ·
 * „Tastenkürzel“ (nur ab 1024 px und nur mit `onTastenkuerzel`, kommt in LT-7) · Verbindungsanzeige.
 * „Zurück“ navigiert selbst zum Spielplan des Turniers (`buildTournamentTabPath`, K5); die Uhr des Spiels läuft weiter.
 */
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { cssVars } from '../../../design-tokens';
import { buildTournamentTabPath } from '../../../features/tournament-management/utils/tournamentTabUtils';

export interface CockpitSlimHeaderProps {
  tournamentId: string;
  turnierName: string;
  felder: number;
  feld: number;
  onFeld: (n: number) => void;
  verbindung: ReactNode;
  /** Nur ab 1024 px (`layout === 'breit'`) und nur mit Handler. */
  breit?: boolean;
  onTastenkuerzel?: () => void;
}

const kopfStil: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: cssVars.spacing.sm, flex: 'none',
  padding: `${cssVars.spacing.xs} ${cssVars.spacing.md}`,
  background: cssVars.colors.surfaceSolid, borderBottom: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
};
const knopfStil: CSSProperties = {
  minHeight: cssVars.touchTargets.minimum, minWidth: cssVars.touchTargets.minimum, padding: `0 ${cssVars.spacing.sm}`,
  background: cssVars.colors.surface, color: cssVars.colors.textPrimary, border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`,
  borderRadius: cssVars.borderRadius.md, fontFamily: 'inherit', fontSize: cssVars.fontSizes.md, cursor: 'pointer', whiteSpace: 'nowrap',
};
const nameStil: CSSProperties = {
  fontWeight: cssVars.fontWeights.semibold, fontSize: cssVars.fontSizes.md, color: cssVars.colors.textPrimary,
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0,
};
const feldStil: CSSProperties = { ...knopfStil, fontSize: cssVars.fontSizes.lg, maxWidth: cssVars.sizing.feldwahlMax };

export function CockpitSlimHeader(p: CockpitSlimHeaderProps): ReactElement {
  const { t } = useTranslation('cockpit');
  const navigate = useNavigate();
  return (
    <header style={kopfStil} data-testid="cockpit-slim-header">
      <button type="button" style={knopfStil} data-testid="cockpit-zurueck" aria-label={t('rahmen.zurueckAria')} onClick={() => { void navigate(buildTournamentTabPath(p.tournamentId, 'schedule')); }}>
        ← {t('rahmen.zurueck')}
      </button>
      <span style={nameStil} data-testid="cockpit-turniername">{p.turnierName}</span>
      {p.felder > 1 && (
        <select style={feldStil} data-testid="cockpit-feldwahl" aria-label={t('rahmen.feldAria', { feld: p.feld })} value={p.feld} onChange={(e) => { p.onFeld(Number(e.target.value)); }}>
          {Array.from({ length: p.felder }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{t('rahmen.feld', { feld: n })}</option>)}
        </select>
      )}
      <span style={{ flex: 1 }} />
      {p.breit === true && p.onTastenkuerzel && (
        <button type="button" style={knopfStil} data-testid="cockpit-tastenkuerzel" onClick={p.onTastenkuerzel}>{t('rahmen.tastenkuerzel')}</button>
      )}
      {p.verbindung}
    </header>
  );
}
