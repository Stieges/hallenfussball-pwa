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

    // Handle cockpit settings change
    const handleCockpitSettingsChange = useCallback(
        (newSettings: MatchCockpitSettings) => {
            onTournamentUpdate({
                ...tournament,
                matchCockpitSettings: newSettings,
            });
        },
        [tournament, onTournamentUpdate]
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
            <MatchCockpitSettingsPanel
                settings={cockpitSettings}
                onChange={handleCockpitSettingsChange}
                tournamentId={tournamentId}
                onTestSound={handleTestSound}
            />
        </CategoryPage>
    );
}

export default MatchCockpitCategory;
