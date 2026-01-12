import React from 'react';
import { cssVars } from '../../design-tokens';
import { TeamAvatar } from '../ui/TeamAvatar';
import { FinalPlacement } from '../../utils/calculations';

interface FinalRankingsTableProps {
    rankings: FinalPlacement[];
}

export const FinalRankingsTable: React.FC<FinalRankingsTableProps> = ({ rankings }) => {
    if (rankings.length === 0) {
        return null;
    }

    // Styles reused to match GroupTables
    const containerStyle: React.CSSProperties = {
        background: cssVars.colors.background,
        border: `1px solid ${cssVars.colors.border}`,
        borderRadius: cssVars.borderRadius.md,
        padding: cssVars.spacing.md,
        minWidth: 0,
        overflow: 'hidden',
        marginTop: cssVars.spacing.lg, // Separate from GroupTables
    };

    const titleStyle: React.CSSProperties = {
        fontSize: cssVars.fontSizes.lg,
        fontWeight: cssVars.fontWeights.semibold,
        color: cssVars.colors.primary,
        marginBottom: '12px',
    };

    const tableStyle: React.CSSProperties = {
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: cssVars.fontSizes.md,
    };

    const thStyle: React.CSSProperties = {
        background: cssVars.colors.primary,
        color: cssVars.colors.background,
        padding: '10px 8px',
        textAlign: 'left',
        fontWeight: cssVars.fontWeights.semibold,
        fontSize: cssVars.fontSizes.sm,
    };

    const tdStyle: React.CSSProperties = {
        padding: '10px 8px',
        borderBottom: `1px solid ${cssVars.colors.border}`,
        color: cssVars.colors.textPrimary,
    };

    return (
        <div style={containerStyle} className="final-rankings-table">
            <h3 style={titleStyle}>Gesamtplatzierung</h3>

            <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                    <thead>
                        <tr>
                            <th style={{ ...thStyle, width: '40px', textAlign: 'center' }}>Pl.</th>
                            <th style={thStyle}>Team</th>
                            <th style={{ ...thStyle, textAlign: 'right' }}>Entscheidung</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rankings.map((placement) => (
                            <tr key={placement.team.id}>
                                <td style={{ ...tdStyle, fontWeight: cssVars.fontWeights.semibold, textAlign: 'center' }}>
                                    {placement.rank}
                                </td>
                                <td style={{ ...tdStyle, fontWeight: cssVars.fontWeights.semibold }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: cssVars.spacing.sm,
                                        wordBreak: 'break-word',
                                    }}>
                                        <TeamAvatar team={placement.team} size="xs" />
                                        {placement.team.name}
                                    </div>
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'right', color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm }}>
                                    {placement.matchLabel ? (
                                        <span style={{
                                            display: 'inline-block',
                                            background: cssVars.colors.surfaceElevated,
                                            padding: '2px 8px',
                                            borderRadius: '12px',
                                            border: `1px solid ${cssVars.colors.border}`,
                                        }}>
                                            {placement.matchLabel}
                                        </span>
                                    ) : (
                                        <span>Gruppenphase</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
