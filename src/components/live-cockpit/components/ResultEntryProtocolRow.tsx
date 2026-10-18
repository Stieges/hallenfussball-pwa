/**
 * ResultEntryProtocolRow (UR, @FU-080): Protokoll-Zeile eines Direkteintrags im Spielplan -- „Ergebnis eingetragen
 * von Olli“ bzw. ohne Namen „Ergebnis eingetragen“ (kein Recht @FU-065, Gast, ohne Netz, Name unbekannt).
 * Gleiches Aussehen wie `ProtocolRow` (Sidebar/BottomSheet), ohne Zeit und ohne Bearbeiten-Knopf.
 * Die Einträge kommen als eigene Liste (`useResultEntryEvents`), nicht über `LiveMatch.events` (R-UR-3).
 */
import { type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { useEventAuthors } from '../../../features/match-engine/useEventAuthors';

export interface ResultEntryProtocolRowsProps {
  /** Turnier des Spiels; `null` = noch unbekannt → Zeilen ohne Namen. */
  tournamentId: string | null;
  matchId: string;
  /** IDs der Direkteinträge (angenommen, nicht zurückgenommen), in Log-Reihenfolge. */
  ids: readonly string[];
  variant: 'sidebar' | 'sheet';
}

const ICON = '📝';

function Row({ name, variant, isLast }: { name: string | null; variant: 'sidebar' | 'sheet'; isLast: boolean }) {
  const { t } = useTranslation('cockpit');
  const text = name ? t('sidebar.resultEntryBy', { name }) : t('sidebar.resultEntry');
  const sidebarStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
    padding: `${cssVars.spacing.sm} 0`,
    borderBottom: isLast ? 'none' : `1px solid ${cssVars.colors.borderSolid}`,
    fontSize: cssVars.fontSizes.sm,
  };
  const sheetStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    padding: cssVars.spacing.md,
    backgroundColor: cssVars.colors.surfaceElevated,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    minHeight: cssVars.touchTargets.primary,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textPrimary,
  };
  const iconStyle: CSSProperties = { fontSize: cssVars.fontSizes.lg, flexShrink: 0 };
  return variant === 'sidebar' ? (
    <div style={sidebarStyle} data-testid="protocol-result-entry">
      <span aria-hidden="true">{ICON}</span>
      <span>{text}</span>
    </div>
  ) : (
    <div style={sheetStyle} data-testid="protocol-result-entry">
      <span style={iconStyle} aria-hidden="true">{ICON}</span>
      <span>{text}</span>
    </div>
  );
}

function RowsWithNames({ tournamentId, matchId, ids, variant }: ResultEntryProtocolRowsProps & { tournamentId: string }) {
  const { nameOf } = useEventAuthors(tournamentId, matchId);
  return (
    <>
      {ids.map((id, index) => <Row key={id} name={nameOf(id)} variant={variant} isLast={index === ids.length - 1} />)}
    </>
  );
}

export function ResultEntryProtocolRows(props: ResultEntryProtocolRowsProps) {
  const { tournamentId, ids, variant } = props;
  if (ids.length === 0) {
    return null;
  }
  if (tournamentId === null) {
    return <>{ids.map((id, index) => <Row key={id} name={null} variant={variant} isLast={index === ids.length - 1} />)}</>;
  }
  return <RowsWithNames {...props} tournamentId={tournamentId} />;
}

export default ResultEntryProtocolRows;
