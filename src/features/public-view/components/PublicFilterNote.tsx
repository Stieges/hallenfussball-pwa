/**
 * Hinweiszeile „✓ Beendet · Alle zeigen“ über dem Spielplan (@ZM-197): ein Filter hinter der Taste „Filter“ bleibt sichtbar,
 * solange er wirkt – mit Häkchen und Wort, nicht nur an der Farbe. „Alle zeigen“ nimmt die Filter hinter der Taste zurück.
 */
import type { CSSProperties, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import type { HiddenFilterKey } from '../publicFilterState';

export interface PublicFilterNoteProps {
  keys: HiddenFilterKey[];
  onShowAll: () => void;
}

const noteStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: cssVars.spacing.sm,
  padding: `${cssVars.spacing.xs} ${cssVars.spacing.xs} ${cssVars.spacing.xs} ${cssVars.spacing.md}`,
  marginBottom: cssVars.spacing.sm,
  background: cssVars.colors.primaryLight,
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.primary}`,
  borderRadius: cssVars.borderRadius.lg,
  color: cssVars.colors.textPrimary,
  minWidth: 0,
};
const wordStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: cssVars.spacing.sm, fontSize: cssVars.fontSizes.md, fontWeight: cssVars.fontWeights.bold, minWidth: 0, overflowWrap: 'break-word' };
const buttonStyle: CSSProperties = { minHeight: cssVars.touchTargets.minimum, flex: 'none', whiteSpace: 'nowrap' };

export function PublicFilterNote({ keys, onShowAll }: PublicFilterNoteProps): ReactElement | null {
  const { t } = useTranslation('publicView');
  const { t: tSport } = useTranslation('sport');
  if (keys.length === 0) {
    return null;
  }
  const word = (key: HiddenFilterKey): string => {
    switch (key) {
      case 'phase:groupStage': return tSport('tournament.groupStage');
      case 'phase:final': return tSport('tournament.finals');
      case 'status:scheduled': return tSport('status.scheduled');
      case 'status:live': return t('filter.liveWord');
      case 'status:finished': return tSport('status.finished');
      case 'myTeam': return t('filter.onlyMyTeam');
    }
  };
  return (
    <div style={noteStyle} role="status" data-testid="public-filter-note">
      <span style={wordStyle}>
        <svg viewBox="0 0 24 24" width="1.25em" height="1.25em" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ color: cssVars.colors.primary, flex: 'none' }}>
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
        {keys.map(word).join(' · ')}
      </span>
      <Button variant="secondary" onClick={onShowAll} style={buttonStyle} data-testid="public-filter-show-all">{t('filter.showAll')}</Button>
    </div>
  );
}
