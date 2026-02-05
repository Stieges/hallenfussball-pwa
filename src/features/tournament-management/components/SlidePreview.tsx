/**
 * SlidePreview - Miniature preview thumbnails for monitor slides.
 *
 * NOTE: This component renders at ~15% scale (1920x1080 → ~288x162px).
 * Font sizes are intentionally hardcoded in px because the design token
 * minimum (xs=11px) is too large for miniature rendering. These are NOT
 * regular UI elements - they are scaled-down visual representations.
 */
/* eslint-disable local-rules/no-hardcoded-font-styles */
import { CSSProperties, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../../i18n';
import { cssVars } from '../../../design-tokens';
import type { MonitorSlide, SlideConfig, ColorScheme } from '../../../types/monitor';
import { COLOR_SCHEMES } from '../../../types/monitor';
import type { Tournament, Team } from '../../../types/tournament';
import { calculateStandings } from '../../../utils/calculations';

// =============================================================================
// TYPES
// =============================================================================

interface SlidePreviewProps {
    slide: MonitorSlide;
    tournament: Tournament;
    /** Scale factor for the preview (0.15 = 15% of 1920x1080) */
    scale?: number;
}

// =============================================================================
// STYLES
// =============================================================================

const PREVIEW_WIDTH = 1920;
const PREVIEW_HEIGHT = 1080;
const ASPECT_RATIO = PREVIEW_WIDTH / PREVIEW_HEIGHT;

const containerStyle: CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: cssVars.borderRadius.md,
    border: `1px solid ${cssVars.colors.border}`,
    backgroundColor: '#1A1A2E',
    color: '#FFFFFF',
    fontFamily: cssVars.fontFamilies.body,
};

const slideContentStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8%',
    boxSizing: 'border-box',
    textAlign: 'center',
};

const typeBadgeStyle: CSSProperties = {
    position: 'absolute',
    top: 4,
    left: 4,
    padding: '2px 6px',
    borderRadius: cssVars.borderRadius.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: '#FFF',
    fontSize: '9px',
    fontWeight: 600,
    lineHeight: 1.4,
    zIndex: 1,
};

// =============================================================================
// HELPERS
// =============================================================================

function getFieldDisplayName(fieldId: string | undefined): string {
    if (!fieldId) {
        return i18n.t('tournament:slidePreview.noField', { defaultValue: 'Kein Feld' });
    }
    const num = parseInt(fieldId.replace('field-', ''), 10);
    return isNaN(num) ? fieldId : i18n.t('tournament:slidePreview.fieldLabel', { defaultValue: 'Feld {{num}}', num });
}

function getGroupName(tournament: Tournament, groupId: string | undefined): string {
    if (!groupId) {
        return i18n.t('tournament:slidePreview.allGroups', { defaultValue: 'Alle Gruppen' });
    }
    const group = tournament.groups?.find(g => g.id === groupId);
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Empty customName should use fallback
    return group?.customName || i18n.t('tournament:slidePreview.groupLabel', { defaultValue: 'Gruppe {{id}}', id: groupId });
}

function getTeamName(teams: Team[], teamIdOrName: string): string {
    const team = teams.find(t => t.id === teamIdOrName || t.name === teamIdOrName);
    return team?.name ?? teamIdOrName;
}

// =============================================================================
// SLIDE TYPE RENDERERS (Miniatur-Versionen)
// =============================================================================

function LivePreview({ config, tournament }: { config: SlideConfig; tournament: Tournament }) {
    const fieldName = getFieldDisplayName(config.fieldId);

    // Find a running or next match for this field
    const fieldNum = config.fieldId ? parseInt(config.fieldId.replace('field-', ''), 10) : 1;
    const nextMatch = tournament.matches?.find(m =>
        m.field === fieldNum && (m.scoreA === undefined || m.scoreA === null)
    );

    const teamA = nextMatch ? getTeamName(tournament.teams, nextMatch.teamA) : 'Team A';
    const teamB = nextMatch ? getTeamName(tournament.teams, nextMatch.teamB) : 'Team B';

    return (
        <div style={slideContentStyle}>
            <div style={{ fontSize: '8px', opacity: 0.7, marginBottom: '4px' }}>{fieldName}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700 }}>
                <span>{teamA.slice(0, 8)}</span>
                <span style={{ fontSize: '14px', color: '#00E676' }}>0 : 0</span>
                <span>{teamB.slice(0, 8)}</span>
            </div>
            <div style={{ fontSize: '7px', opacity: 0.5, marginTop: '3px' }}>10:00</div>
        </div>
    );
}

function StandingsPreview({ config, tournament }: { config: SlideConfig; tournament: Tournament }) {
    const groupName = getGroupName(tournament, config.groupId);
    const standings = useMemo(() => {
        if (!tournament.teams || !tournament.matches) {
            return [];
        }
        return calculateStandings(tournament.teams, tournament.matches, tournament, config.groupId);
    }, [tournament, config.groupId]);

    const topTeams = standings.slice(0, 3);

    return (
        <div style={{ ...slideContentStyle, justifyContent: 'flex-start', paddingTop: '12%' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, marginBottom: '4px' }}>{groupName}</div>
            {topTeams.length > 0 ? (
                <div style={{ width: '80%' }}>
                    {topTeams.map((s, i) => (
                        <div key={s.team.id} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '7px',
                            padding: '1px 0',
                            opacity: 1 - i * 0.2,
                        }}>
                            <span>{i + 1}. {s.team.name.slice(0, 10)}</span>
                            <span style={{ fontWeight: 700 }}>{s.points}</span>
                        </div>
                    ))}
                    {standings.length > 3 && (
                        <div style={{ fontSize: '6px', opacity: 0.4, marginTop: '2px' }}>
                            {i18n.t('tournament:slidePreview.moreItems', { defaultValue: '+{{count}} weitere', count: standings.length - 3 })}
                        </div>
                    )}
                </div>
            ) : (
                <div style={{ fontSize: '7px', opacity: 0.5 }}>{i18n.t('tournament:slidePreview.noData', { defaultValue: 'Keine Daten' })}</div>
            )}
        </div>
    );
}

function ScheduleFieldPreview({ config, tournament }: { config: SlideConfig; tournament: Tournament }) {
    const fieldName = getFieldDisplayName(config.fieldId);
    const fieldNum = config.fieldId ? parseInt(config.fieldId.replace('field-', ''), 10) : 1;
    const matches = tournament.matches?.filter(m => m.field === fieldNum).slice(0, 3) ?? [];

    return (
        <div style={{ ...slideContentStyle, justifyContent: 'flex-start', paddingTop: '12%' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, marginBottom: '4px' }}>{fieldName}</div>
            {matches.length > 0 ? (
                <div style={{ width: '85%' }}>
                    {matches.map((m, i) => (
                        <div key={m.id ?? i} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '7px',
                            padding: '1px 0',
                            opacity: 1 - i * 0.15,
                        }}>
                            <span>{getTeamName(tournament.teams, m.teamA).slice(0, 6)}</span>
                            <span style={{ opacity: 0.5 }}>vs</span>
                            <span>{getTeamName(tournament.teams, m.teamB).slice(0, 6)}</span>
                        </div>
                    ))}
                </div>
            ) : (
                <div style={{ fontSize: '7px', opacity: 0.5 }}>{i18n.t('tournament:slidePreview.noMatches', { defaultValue: 'Keine Spiele' })}</div>
            )}
        </div>
    );
}

function SponsorPreview({ config, tournament }: { config: SlideConfig; tournament: Tournament }) {
    const sponsor = tournament.sponsors?.find(s => s.id === config.sponsorId);
    const name = sponsor?.name ?? 'Sponsor';

    return (
        <div style={slideContentStyle}>
            <div style={{
                width: '50px',
                height: '30px',
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '4px',
                fontSize: '16px',
            }}>
                {sponsor?.logoUrl || sponsor?.logoBase64 ? (
                    <img
                        src={sponsor.logoUrl ?? sponsor.logoBase64}
                        alt={name}
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                    />
                ) : '📢'}
            </div>
            <div style={{ fontSize: '8px', fontWeight: 600 }}>{name.slice(0, 15)}</div>
        </div>
    );
}

function CustomTextPreview({ config }: { config: SlideConfig }) {
    const scheme: ColorScheme = config.colorScheme ?? 'default';
    const colors = COLOR_SCHEMES[scheme];

    return (
        <div style={{
            ...slideContentStyle,
            backgroundColor: colors.background,
            color: colors.text,
        }}>
            <div style={{ fontSize: '9px', fontWeight: 700 }}>
                {config.headline?.slice(0, 20) ?? i18n.t('tournament:slidePreview.headlineDefault', { defaultValue: 'Überschrift' })}
            </div>
            {config.body && (
                <div style={{ fontSize: '7px', opacity: 0.8, marginTop: '2px' }}>
                    {config.body.slice(0, 40)}{config.body.length > 40 ? '...' : ''}
                </div>
            )}
        </div>
    );
}

function Phase2Preview({ type }: { type: string }) {
    return (
        <div style={{ ...slideContentStyle, opacity: 0.5 }}>
            <div style={{ fontSize: '8px' }}>Phase 2</div>
            <div style={{ fontSize: '7px', opacity: 0.6 }}>{type}</div>
        </div>
    );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function SlidePreview({ slide, tournament, scale = 0.15 }: SlidePreviewProps) {
    const { t } = useTranslation('tournament');
    const width = PREVIEW_WIDTH * scale;
    const height = width / ASPECT_RATIO;

    const previewContainerStyle: CSSProperties = {
        ...containerStyle,
        width,
        height,
    };

    const typeLabel = getTypeLabel(slide.type);

    return (
        <div style={previewContainerStyle} aria-label={t('slidePreview.previewAria', { type: typeLabel })}>
            <span style={typeBadgeStyle}>{typeLabel}</span>
            {renderPreview(slide, tournament)}
        </div>
    );
}

function getTypeLabel(type: string): string {
    const keyMap: Record<string, string> = {
        'live': 'slidePreview.types.live',
        'standings': 'slidePreview.types.standings',
        'schedule-field': 'slidePreview.types.scheduleField',
        'sponsor': 'slidePreview.types.sponsor',
        'custom-text': 'slidePreview.types.customText',
        'all-standings': 'slidePreview.types.allStandings',
        'schedule-group': 'slidePreview.types.scheduleGroup',
        'next-matches': 'slidePreview.types.nextMatches',
        'top-scorers': 'slidePreview.types.topScorers',
    };
    const key = keyMap[type];
    return key ? i18n.t(`tournament:${key}`, { defaultValue: type }) : type;
}

function renderPreview(slide: MonitorSlide, tournament: Tournament) {
    switch (slide.type) {
        case 'live':
            return <LivePreview config={slide.config} tournament={tournament} />;
        case 'standings':
            return <StandingsPreview config={slide.config} tournament={tournament} />;
        case 'schedule-field':
            return <ScheduleFieldPreview config={slide.config} tournament={tournament} />;
        case 'sponsor':
            return <SponsorPreview config={slide.config} tournament={tournament} />;
        case 'custom-text':
            return <CustomTextPreview config={slide.config} />;
        default:
            return <Phase2Preview type={slide.type} />;
    }
}
