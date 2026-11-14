/**
 * MatchCockpitCategory
 *
 * Dedicated settings category for Live Cockpit configuration.
 * Wraps the MatchCockpitSettingsPanel.
 */

import { useCallback } from 'react';
import { CategoryPage } from '../shared';
import { MatchCockpitSettingsPanel } from '../../../../components/match-settings/MatchCockpitSettingsPanel';
import { useMatchSound } from '../../../../hooks';
import { useCockpitTon } from '../../../../components/live-cockpit/hooks/useCockpitTon';
import { useCan } from '../../../auth/hooks/useCan';
import { RulesLockProvider } from '../../../../components/match-settings/RulesLockContext';
import type { Tournament, MatchCockpitSettings } from '../../../../types/tournament';
import { DEFAULT_MATCH_COCKPIT_SETTINGS } from '../../../../types/tournament';
import { HallentonKarte } from './HallentonKarte';
import { MatchRulesSection } from './MatchRulesSection';
import { FoulLimitSection } from './FoulLimitSection';
import { sectionSecondsOf } from './sectionSeconds';
import { ForfeitScoreField } from '../../../../components/match-settings/ForfeitScoreField';
import { changeForfeitScore, effectiveForfeitScore, forfeitScoreLocked } from '../../../../core/models/forfeit';
import type { ForfeitScore } from '../../../../types/tournament';

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

    // „Anhören“: gewählter Ton mit der Lautstärke dieses Geräts (H4-12: Ein/Aus und Lautstärke gelten je Gerät, nicht je Turnier)
    const geraetTon = useCockpitTon();
    const sound = useMatchSound(
        cockpitSettings.soundId,
        geraetTon.lautstaerke,
        cockpitSettings.soundId !== null,
        tournamentId
    );

    // Spielregeln (@W2A-030) ändert nur die Turnierleitung
    const canChangeRules = useCan('tournamentSettings', tournamentId);

    // Handle cockpit settings change
    const handleCockpitSettingsChange = useCallback(
        (newSettings: MatchCockpitSettings) => {
            // @W2A-030: eine Regeländerung ohne Turnierleitung wird nicht gespeichert
            const gespeichert = getCockpitSettings(tournament);
            if (
                !canChangeRules &&
                (newSettings.timePenaltyDurationSeconds !== gespeichert.timePenaltyDurationSeconds ||
                    newSettings.penaltyShootersPerTeam !== gespeichert.penaltyShootersPerTeam ||
                    newSettings.penaltyEndsOnGoal !== gespeichert.penaltyEndsOnGoal ||
                    newSettings.clockMode !== gespeichert.clockMode ||
                    newSettings.foulLimit !== gespeichert.foulLimit ||
                    newSettings.finalPhaseMinutes !== gespeichert.finalPhaseMinutes)
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

    // @W2A-025 / @W2A-078: Wertung bei Nichtantritt – gesperrt, sobald ein Spiel so gewertet ist (Regel `changeForfeitScore`)
    const handleForfeitScoreChange = useCallback(
        (next: ForfeitScore) => {
            const change = changeForfeitScore(tournament, next);
            if (!canChangeRules || !change.ok) {
                return;
            }
            onTournamentUpdate({ ...tournament, forfeitScore: change.forfeitScore });
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
            description="Konfiguration für das Live-Scoreboard, den Timer und das Feedback"
        >
            <RulesLockProvider value={!canChangeRules}>
                <MatchRulesSection
                    value={cockpitSettings.clockMode}
                    locked={!canChangeRules}
                    onChange={(clockMode) => handleCockpitSettingsChange({ ...cockpitSettings, clockMode })}
                    finalPhaseMinutes={cockpitSettings.finalPhaseMinutes}
                    sectionSeconds={sectionSecondsOf(tournament)}
                    onFinalPhaseChange={(finalPhaseMinutes) => handleCockpitSettingsChange({ ...cockpitSettings, finalPhaseMinutes })}
                />
                <FoulLimitSection
                    value={cockpitSettings.foulLimit}
                    locked={!canChangeRules}
                    onChange={(foulLimit) => handleCockpitSettingsChange({ ...cockpitSettings, foulLimit })}
                />
                <ForfeitScoreField
                    value={effectiveForfeitScore(tournament)}
                    locked={forfeitScoreLocked(tournament)}
                    disabled={!canChangeRules}
                    onChange={handleForfeitScoreChange}
                />
                <HallentonKarte tournamentId={tournamentId} />
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
