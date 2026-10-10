/**
 * MatchCockpitCategory
 *
 * Dedicated settings category for Live Cockpit configuration.
 * Wraps the MatchCockpitSettingsPanel.
 */

import { useCallback } from 'react';
import { CategoryPage } from '../shared';
import { MatchCockpitSettingsPanel } from '../../../../components/match-cockpit/MatchCockpitSettingsPanel';
import { useMatchSound } from '../../../../hooks';
import { useMyTournamentRole } from '../../../auth/hooks/useMyTournamentRole';
import { canManageTournament } from '../../../auth/utils/permissions';
import { RulesLockProvider } from '../../../../components/match-cockpit/RulesLockContext';
import type { Tournament, MatchCockpitSettings } from '../../../../types/tournament';
import { DEFAULT_MATCH_COCKPIT_SETTINGS } from '../../../../types/tournament';

// =============================================================================
// PROPS
// =============================================================================

interface MatchCockpitCategoryProps {
    tournamentId: string;
    tournament: Tournament;
    onTournamentUpdate: (tournament: Tournament) => void;
}

// Helper to get cockpit settings with defaults
function getCockpitSettings(tournament: Tournament): MatchCockpitSettings {
    return {
        ...DEFAULT_MATCH_COCKPIT_SETTINGS,
        ...tournament.matchCockpitSettings,
    };
}

// =============================================================================
// COMPONENT
// =============================================================================

export function MatchCockpitCategory({
    tournamentId,
    tournament,
    onTournamentUpdate,
}: MatchCockpitCategoryProps) {
    // Match Cockpit Pro settings
    const cockpitSettings = getCockpitSettings(tournament);

    // Sound hook for testing
    const sound = useMatchSound(
        cockpitSettings.soundId,
        cockpitSettings.soundVolume,
        cockpitSettings.soundEnabled,
        tournamentId
    );

    // Spielregeln (@W2A-030) ändert nur die Turnierleitung
    const { role: myRole } = useMyTournamentRole(tournamentId);
    const canChangeRules = myRole ? canManageTournament(myRole) : false;

    // Handle cockpit settings change
    const handleCockpitSettingsChange = useCallback(
        (newSettings: MatchCockpitSettings) => {
            // @W2A-030: eine Regeländerung ohne Turnierleitung wird nicht gespeichert
            const gespeichert = getCockpitSettings(tournament);
            if (
                !canChangeRules &&
                (newSettings.timePenaltyDurationSeconds !== gespeichert.timePenaltyDurationSeconds ||
                    newSettings.penaltyShootersPerTeam !== gespeichert.penaltyShootersPerTeam)
            ) {
                return;
            }
            onTournamentUpdate({
                ...tournament,
                matchCockpitSettings: newSettings,
            });
        },
        [tournament, onTournamentUpdate, canChangeRules]
    );

    // Handle test sound
    const handleTestSound = useCallback(() => {
        void sound.testPlay();
    }, [sound]);

    return (
        <CategoryPage
            icon="🎮"
            title="Match Cockpit"
            description="Konfiguration für das Live-Scoreboard, Timer und Sounds"
        >
            <RulesLockProvider value={!canChangeRules}>
                <MatchCockpitSettingsPanel
                    settings={cockpitSettings}
                    onChange={handleCockpitSettingsChange}
                    tournamentId={tournamentId}
                    onTestSound={handleTestSound}
                />
            </RulesLockProvider>
        </CategoryPage>
    );
}

export default MatchCockpitCategory;
