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
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import { FeldWahl } from './FeldWahl';
import { buildTournamentTabPath } from '../../../features/tournament-management/utils/tournamentTabUtils';

export interface CockpitSlimHeaderProps {
  tournamentId: string;
  turnierName: string;
  felder: number;
  feld: number;
  onFeld: (n: number) => void;
  /** Steuernde Geräte je Feld für die Feldwahl (@HE-049, B-49). */
  halter?: Readonly<Record<number, string>>;
  verbindung: ReactNode;
  /** B-50 Q8: unauffälliger Einstieg in die Klärungsliste (nur Turnierleitung, nur bei offenen Fällen), links der Verbindung. */
  klaerung?: ReactNode;
  /** Nur ab 1024 px (`layout === 'breit'`) und nur mit Handler. */
  breit?: boolean;
  onTastenkuerzel?: () => void;
}

// Am Handy (unter 768 px) engere Abstände: Zurück, Name (zwei Zeilen), Feldwahl und die Verbindungsanzeige ohne Netz stehen bei 360 px in einer Zeile
const abstand = (schmal: boolean): string => (schmal ? cssVars.spacing.xs : cssVars.spacing.sm);
const kopfStil = (schmal: boolean): CSSProperties => ({
  display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: abstand(schmal), flex: 'none',
  padding: `${cssVars.spacing.xs} ${schmal ? cssVars.spacing.sm : cssVars.spacing.md}`,
  background: cssVars.colors.surfaceSolid, borderBottom: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
});
const knopfStil: CSSProperties = {
  flex: 'none', minHeight: cssVars.touchTargets.minimum, minWidth: cssVars.touchTargets.minimum, padding: `0 ${cssVars.spacing.sm}`,
  background: cssVars.colors.surface, color: cssVars.colors.textPrimary, border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`,
  borderRadius: cssVars.borderRadius.md, fontFamily: 'inherit', fontSize: cssVars.fontSizes.md, cursor: 'pointer', whiteSpace: 'nowrap',
};
// Name und Feldwahl bilden eine Gruppe, die den Rest der Zeile nimmt (Verbindungsanzeige und Tastenkürzel stehen so rechts).
// Basis 0 + `min-content`: die Anzeige rechts bleibt in der Zeile, nur ein einzelnes zu langes Wort schiebt sie nach unten.
const gruppeStil = (schmal: boolean): CSSProperties => ({ display: 'flex', alignItems: 'center', gap: abstand(schmal), flex: '1 1 0', minWidth: 'min-content' });
const nameStil: CSSProperties = {
  fontWeight: cssVars.fontWeights.semibold, fontSize: cssVars.fontSizes.md, color: cssVars.colors.textPrimary,
  // Der Name wird nie abgeschnitten: er bricht um (nie mitten im Wort) statt mit Auslassungspunkten zu enden (visuelle Prüfung,
  // text.abgeschnitten, titel.wortbruch). Zwei Zeilen in Fließtext-Zeilenhöhe passen in die Tippfläche: der Kopf wächst nicht.
  flex: '0 1 auto', overflowWrap: 'break-word', lineHeight: cssVars.lineHeights.bodyMd, minWidth: 'min-content',
};

export function CockpitSlimHeader(p: CockpitSlimHeaderProps): ReactElement {
  const { t } = useTranslation('cockpit');
  const navigate = useNavigate();
  const breitePruefung = useBreakpoint();
  const schmal = breitePruefung.isMobile;
  const breit = p.breit ?? breitePruefung.isDesktop;
  return (
    <header style={kopfStil(schmal)} data-testid="cockpit-slim-header">
      <button type="button" style={knopfStil} data-testid="cockpit-zurueck" aria-label={t('rahmen.zurueckAria')} onClick={() => { void navigate(buildTournamentTabPath(p.tournamentId, 'schedule')); }}>
        ← {t('rahmen.zurueck')}
      </button>
      <div style={gruppeStil(schmal)}>
        <span style={nameStil} data-testid="cockpit-turniername">{p.turnierName}</span>
        <FeldWahl felder={p.felder} feld={p.feld} onFeld={p.onFeld} halter={p.halter} />
      </div>
      {breit && p.onTastenkuerzel && (
        <button type="button" style={knopfStil} data-testid="cockpit-tastenkuerzel" onClick={p.onTastenkuerzel}>{t('rahmen.tastenkuerzel')}</button>
      )}
      {p.klaerung}
      {p.verbindung}
    </header>
  );
}
