/**
 * „Nach dem Ende eingetroffen“ (@LZ-039, @LZ-040, @FU-018; Mockup Zustand C): Einträge, die erst nach dem Abschluss ankamen. Sie
 * zählen nicht im Endstand, bleiben aber erhalten und stehen hier mit Name und Zeit (E8). Nur für die Turnierleitung.
 */
import { useTranslation } from 'react-i18next';
import type { Tournament } from '../../../types/tournament';
import { cssVars } from '../../../design-tokens';
import { useFinishT } from '../hooks/useFinishT';
import type { LateEntriesState } from '../hooks/useLateEntries';
import { describeLateEntry } from '../model/finishLate';
import { card, heading, listReset, small, strong } from './finishStyles';

export interface LateEntriesCardProps {
  tournament: Pick<Tournament, 'teams' | 'matches' | 'groups'>;
  late: LateEntriesState;
  /** Konto dieses Geräts (sein Eintrag trägt den eigenen Namen). */
  self?: { id: string; name: string | null };
}

/** Nur Darstellung: Lesen und Konto stecken im Aufrufer (`FinishedStateSection`). */
export function LateEntriesCard({ tournament, late, self }: LateEntriesCardProps) {
  const { t, i18n } = useTranslation('tournament');
  const tt = useFinishT();
  return (
    <section style={card} data-testid="late-entries" aria-labelledby="late-entries-title">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: cssVars.spacing.sm }}>
        <h3 id="late-entries-title" style={heading}>{t('finish.late.title')}</h3>
        {late.entries.length > 0 && (
          <span style={{ ...small, border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`, borderRadius: cssVars.borderRadius.full, padding: `0 ${cssVars.spacing.sm}`, color: cssVars.colors.textPrimary }} data-testid="late-entries-count">
            {late.entries.length}
          </span>
        )}
      </div>
      <p style={small}>{t('finish.late.text')}</p>
      {late.status === 'unavailable' && <p style={small} role="status" data-testid="late-entries-unavailable">{t('finish.late.unavailable')}</p>}
      {late.status === 'ready' && late.entries.length === 0 && <p style={small} data-testid="late-entries-empty">{t('finish.late.empty')}</p>}
      {late.entries.length > 0 && (
        <ul style={listReset}>
          {late.entries.map((entry) => {
            const view = describeLateEntry(entry, { tournament, self, language: i18n.language }, tt);
            return (
              <li key={view.id} data-testid="late-entry" style={{ display: 'grid', gap: cssVars.spacing.xs, padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`, border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`, borderRadius: cssVars.borderRadius.md, background: cssVars.colors.background }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: cssVars.spacing.sm, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <span style={{ ...strong, fontSize: cssVars.fontSizes.md }}>{view.title}</span>
                  <span style={{ ...small, color: cssVars.colors.textPrimary, border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.warning}`, background: cssVars.colors.warningLight, borderRadius: cssVars.borderRadius.full, padding: `0 ${cssVars.spacing.sm}`, fontWeight: cssVars.fontWeights.semibold }}>{t('finish.late.notCounted')}</span>
                </div>
                {view.matchLine !== null && <span style={small}>{view.matchLine}</span>}
                <span style={small}>{view.byLine}</span>
                {view.receivedLine !== null && <span style={small}>{view.receivedLine}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
