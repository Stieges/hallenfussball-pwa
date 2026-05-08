import { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { ScoreHeader } from '../MatchSummary/ScoreHeader';
import { EventList } from '../MatchSummary/EventList';
import type { RuntimeMatchEvent } from '../../../types/tournament';

export interface SummaryExpandProps {
    homeTeamName: string;
    awayTeamName: string;
    homeScore: number;
    awayScore: number;
    homeTeamId: string;
    awayTeamId: string;
    events: RuntimeMatchEvent[];
    onEditScore?: () => void;
    onEditEvent?: (event: RuntimeMatchEvent) => void;
    onClose?: () => void;
}

export function SummaryExpand({
    homeTeamName,
    awayTeamName,
    homeScore,
    awayScore,
    homeTeamId,
    awayTeamId,
    events,
    onEditScore,
    onEditEvent,

}: SummaryExpandProps) {
    const { t } = useTranslation('tournament');

    const containerStyle: CSSProperties = {
        padding: cssVars.spacing.md,
        backgroundColor: cssVars.colors.surface,
        borderTop: `1px solid ${cssVars.colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        gap: cssVars.spacing.md,
    };

    const sectionTitleStyle: CSSProperties = {
        fontSize: cssVars.fontSizes.sm,
        fontWeight: cssVars.fontWeights.semibold,
        color: cssVars.colors.textSecondary,
        margin: 0,
        marginBottom: cssVars.spacing.sm,
    };

    const eventsSectionStyle: CSSProperties = {
        maxHeight: '300px',
        overflowY: 'auto',
    };

    // Reuse ScoreHeader but maybe check if it fits inline context
    // The ScoreHeader generic component should work fine.

    return (
        <div style={containerStyle}>
            <ScoreHeader
                homeTeamName={homeTeamName}
                awayTeamName={awayTeamName}
                homeScore={homeScore}
                awayScore={awayScore}
                onEditScore={onEditScore}
                compact
            />

            {/* Events */}
            <div>
                <h3 style={sectionTitleStyle}>{t('matchExpand.summary.events')}</h3>
                {events.length > 0 ? (
                    <div style={eventsSectionStyle}>
                        <EventList
                            events={events}
                            homeTeamId={homeTeamId}
                            awayTeamId={awayTeamId}
                            homeTeamName={homeTeamName}
                            awayTeamName={awayTeamName}
                            onEventEdit={onEditEvent}
                            compact
                        />
                    </div>
                ) : (
                    <div style={{ padding: cssVars.spacing.sm, textAlign: 'center', color: cssVars.colors.textMuted, fontSize: cssVars.fontSizes.sm, fontStyle: 'italic' }}>
                        {t('matchExpand.summary.noEvents')}
                    </div>
                )}
            </div>

            {/* Close/Action Footer if needed? Usually expand closes on click outside or header click */}
            {/* GroupStageSchedule logic should handle closing via existing expand behavior */}
        </div>
    );
}
