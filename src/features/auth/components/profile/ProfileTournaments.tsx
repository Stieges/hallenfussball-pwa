import React, { CSSProperties } from 'react';
import { cssVars } from '../../../../design-tokens';
import { Button } from '../../../../components/ui/Button';
import { TournamentCard } from '../TournamentCard';
import type { TournamentSortOption } from '../../hooks/useUserTournaments';
import type { UserTournament } from '../../hooks/useUserTournaments';

interface ProfileTournamentsProps {
    tournaments: UserTournament[];
    isLoading: boolean;
    totalCount: number;
    sortBy: TournamentSortOption;
    setSortBy: (option: TournamentSortOption) => void;
    onCreateTournament: (() => void) | undefined;
    onOpenTournament: ((id: string) => void) | undefined;
}

export const ProfileTournaments: React.FC<ProfileTournamentsProps> = ({
    tournaments,
    isLoading,
    totalCount,
    sortBy,
    setSortBy,
    onCreateTournament,
    onOpenTournament,
}) => {
    return (
        <div style={styles.container}>
            <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>Meine Turniere</h2>
                {totalCount > 1 && (
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as TournamentSortOption)}
                        style={styles.sortSelect}
                    >
                        <option value="status">Status</option>
                        <option value="recent">Zuletzt</option>
                        <option value="name">A-Z</option>
                        <option value="date">Datum</option>
                    </select>
                )}
            </div>

            {/* List */}
            {isLoading ? (
                <div style={styles.loadingState}>Lade Turniere...</div>
            ) : tournaments.length === 0 ? (
                <div style={styles.emptyState}>
                    <p style={styles.emptyText}>Noch keine Turniere vorhanden.</p>
                    <Button variant="primary" onClick={onCreateTournament}>
                        Jetzt erstes Turnier erstellen
                    </Button>
                </div>
            ) : (
                <div style={styles.tournamentList}>
                    {tournaments.map((item) => (
                        <TournamentCard
                            key={item.tournament.id}
                            tournament={item.tournament}
                            membership={item.membership}
                            teamNames={item.teamNames}
                            onClick={() => onOpenTournament?.(item.tournament.id)}
                        />
                    ))}
                </div>
            )}
            {/* Create Button (sticky or bottom) */}
            {tournaments.length > 0 && (
                <Button
                    variant="secondary"
                    fullWidth
                    onClick={onCreateTournament}
                    style={{ marginTop: cssVars.spacing.md }}
                >
                    ＋ Neues Turnier
                </Button>
            )}
        </div>
    );
};

const styles: Record<string, CSSProperties> = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        minWidth: '300px',
    },
    sectionHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: cssVars.spacing.md,
    },
    sectionTitle: {
        margin: 0,
        fontSize: cssVars.fontSizes.lg,
        fontWeight: cssVars.fontWeights.semibold,
    },
    sortSelect: {
        padding: cssVars.spacing.xs,
        borderRadius: cssVars.borderRadius.md,
        border: `1px solid ${cssVars.colors.border}`,
        background: cssVars.colors.surface,
        color: cssVars.colors.textPrimary,
    },
    tournamentList: {
        display: 'flex',
        flexDirection: 'column',
        gap: cssVars.spacing.md,
    },
    emptyState: {
        textAlign: 'center',
        padding: cssVars.spacing.xl,
        background: cssVars.colors.surface,
        borderRadius: cssVars.borderRadius.lg,
        border: `1px dashed ${cssVars.colors.border}`,
        color: cssVars.colors.textSecondary,
    },
    emptyText: {
        marginBottom: cssVars.spacing.md,
    },
    loadingState: {
        textAlign: 'center',
        padding: cssVars.spacing.xl,
        color: cssVars.colors.textSecondary,
    },
};
