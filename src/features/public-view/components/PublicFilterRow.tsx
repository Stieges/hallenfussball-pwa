/**
 * Filterzeile der Zuschauer-Seite (@ZM-196, @ZM-197): links die Gruppen-Auswahl „Alle · A · B“ (nur bei mehr als einer Gruppe,
 * passen nicht alle Chips in die Zeile, wischt sie waagrecht), rechts die Taste „Filter“. Phase und Status liegen hinter der
 * Taste (Blatt von unten, `PublicFilterSheet`); ein gesetzter Filter macht die Taste zu „Filter (n)“ mit kräftigem Rand.
 * Alle Tippziele mindestens 44 Bildpunkte (@OB-022).
 */
import type { CSSProperties, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';

export interface PublicFilterRowProps {
  groups: string[];
  selectedGroup: string | null;
  /** Zahl der gesetzten Filter hinter der Taste (Phase, Status) */
  hiddenCount: number;
  sheetOpen: boolean;
  onGroupChange: (group: string | null) => void;
  onOpenSheet: () => void;
}

/** Begründung für die visuelle Prüfung (Wortlaut ohne deutsche Anzeigetexte: B-41-Scan): ein Chip außerhalb des Ausschnitts der wischbaren Reihe ist abgeschnitten, nie von der Taste „Filter“ verdeckt (@ZM-196, Aber-Zeile). */
const WISCHBEREICH = 'scroll area: a chip outside the visible part is clipped, never covered by the filter button (ZM-196)';

const rowStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: cssVars.spacing.sm, marginBottom: cssVars.spacing.sm, minWidth: 0 };
const groupsStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: cssVars.spacing.xs, minWidth: 0, overflowX: 'auto', flex: '1 1 auto' };
const labelStyle: CSSProperties = { fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary, flex: 'none', paddingRight: cssVars.spacing.xs };

/** Rund, 44 × 44 Bildpunkte, mit Rand (3 : 1); gewählt in der Hauptfarbe mit Wort, nie nur Farbe. */
const chipStyle = (active: boolean): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
  minHeight: cssVars.touchTargets.minimum, minWidth: cssVars.touchTargets.minimum,
  padding: `0 ${cssVars.spacing.sm}`,
  borderRadius: cssVars.borderRadius.full,
  border: `${cssVars.borderWidth.thin} solid ${active ? cssVars.colors.primary : cssVars.colors.borderControl}`,
  background: active ? cssVars.colors.primary : cssVars.colors.background,
  color: active ? cssVars.colors.background : cssVars.colors.textPrimary,
  fontSize: cssVars.fontSizes.md,
  fontWeight: active ? cssVars.fontWeights.bold : cssVars.fontWeights.normal,
  cursor: 'pointer',
});

const filterButtonStyle = (set: boolean): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: cssVars.spacing.xs, flex: 'none',
  minHeight: cssVars.touchTargets.minimum,
  padding: `0 ${cssVars.spacing.md}`,
  borderRadius: cssVars.borderRadius.md,
  border: `${set ? cssVars.borderWidth.medium : cssVars.borderWidth.thin} solid ${set ? cssVars.colors.primary : cssVars.colors.borderControl}`,
  background: cssVars.colors.background,
  color: cssVars.colors.textPrimary,
  fontSize: cssVars.fontSizes.md,
  fontWeight: set ? cssVars.fontWeights.bold : cssVars.fontWeights.semibold,
  cursor: 'pointer',
  marginLeft: 'auto',
});

/** Regler-Symbol (Linien, erbt die Textfarbe). */
function SlidersIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" width="1.25em" height="1.25em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" />
    </svg>
  );
}

export function PublicFilterRow({ groups, selectedGroup, hiddenCount, sheetOpen, onGroupChange, onOpenSheet }: PublicFilterRowProps): ReactElement {
  const { t } = useTranslation('publicView');
  return (
    <div style={rowStyle} data-testid="public-filter-bar">
      {groups.length > 1 && (
        <div style={groupsStyle} role="group" aria-label={t('filter.groupLabel')} data-testid="public-group-chips">
          <span style={labelStyle}>{t('filter.groupLabel')}</span>
          <button type="button" style={chipStyle(selectedGroup === null)} aria-pressed={selectedGroup === null} onClick={() => onGroupChange(null)} data-testid="public-group-chip-all" data-overlap-ok={WISCHBEREICH}>
            {t('filter.all')}
          </button>
          {groups.map((group) => (
            <button
              key={group}
              type="button"
              style={chipStyle(selectedGroup === group)}
              aria-pressed={selectedGroup === group}
              aria-label={t('filter.groupAria', { group })}
              onClick={() => onGroupChange(group)}
              data-testid={`public-group-chip-${group}`}
              data-overlap-ok={WISCHBEREICH}
            >
              {group}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        style={filterButtonStyle(hiddenCount > 0)}
        aria-haspopup="dialog"
        aria-expanded={sheetOpen}
        aria-label={hiddenCount > 0 ? t('filter.buttonAria', { n: hiddenCount }) : undefined}
        onClick={onOpenSheet}
        data-testid="public-filter-button"
        data-count={hiddenCount}
      >
        <SlidersIcon />
        {hiddenCount > 0 ? t('filter.buttonCount', { n: hiddenCount }) : t('filter.button')}
      </button>
    </div>
  );
}
