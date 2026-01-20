import { Card, Select, NumberStepper, CollapsibleSection } from '../../components/ui';
import { Tournament, GroupSystem, PlacementCriterion, MatchCockpitSettings, DEFAULT_MATCH_COCKPIT_SETTINGS } from '../../types/tournament';
import { cssVars, displaySizes } from '../../design-tokens'
import { GROUP_SYSTEM_OPTIONS } from '../../constants/tournamentOptions';
import { getDFBPattern } from '../../constants/dfbMatchPatterns';
import styles from './Step2_ModeAndSystem.module.css';
import {
  ModeSelection,
  DFBKeySystem,
  DurationEstimate,
  GameTimeConfig,
  PlacementLogicEditor,
  FinalsConfiguration,
  RefereeSettings,
  PointSystemPicker,
  BambiniSettings,
  ValidationWarnings,
  SmartConfig,
} from './components';
import { MatchCockpitSettingsPanel } from '../../components/match-cockpit/MatchCockpitSettingsPanel';

interface Step2Props {
  formData: Partial<Tournament>;
  onUpdate: <K extends keyof Tournament>(field: K, value: Tournament[K]) => void;
  onMovePlacementLogic: (index: number, direction: number) => void;
  onTogglePlacementLogic: (index: number) => void;
  onReorderPlacementLogic?: (newOrder: PlacementCriterion[]) => void;
  /** TOUR-EDIT-STRUCTURE: True wenn Ergebnisse vorhanden sind - blockiert Strukturänderungen */
  hasResults?: boolean;
  /** TOUR-EDIT-STRUCTURE: Callback zum Zurücksetzen des Turniers */
  onResetTournament?: () => void;
}

export const Step2_ModeAndSystem: React.FC<Step2Props> = ({
  formData,
  onUpdate,
  onMovePlacementLogic,
  onTogglePlacementLogic,
  onReorderPlacementLogic,
  hasResults = false,
  onResetTournament,
}) => {
  const canUseGroups = formData.groupSystem === 'groupsAndFinals';
  const useDFBKeys = formData.useDFBKeys ?? false;

  // TOUR-EDIT-STRUCTURE: Strukturfelder sind gesperrt wenn Ergebnisse vorhanden
  const structureFieldsLocked = hasResults;

  const handleTeamCountChange = (newCount: number) => {
    onUpdate('numberOfTeams', newCount);

    // Auto-select matching DFB pattern if DFB mode is enabled
    if (useDFBKeys) {
      const pattern = getDFBPattern(newCount);
      if (pattern) {
        onUpdate('dfbKeyPattern', pattern.code);
      }
    }
  };

  // Helper to get placement logic summary
  const getPlacementSummary = (): string => {
    if (!formData.placementLogic) {return '';}
    const active = formData.placementLogic.filter(p => p.enabled);
    return `${active.length} aktive Kriterien`;
  };

  // Helper to get referee summary
  const getRefereeSummary = (): string => {
    const mode = formData.refereeConfig?.mode;
    if (mode === 'none') {return 'Keine';}
    if (mode === 'organizer') {
      const count = formData.refereeConfig?.numberOfReferees ?? 0;
      return `${count} SR`;
    }
    if (mode === 'teams') {return 'Teams stellen SR';}
    return 'Keine';
  };

  // Helper to get time planning summary
  const getTimeSummary = (): string => {
    const gameDuration = formData.groupPhaseGameDuration ?? 10;
    const breakDuration = formData.groupPhaseBreakDuration ?? 2;
    return `${gameDuration}′ Spiel / ${breakDuration}′ Pause`;
  };

  // Helper to get finals summary
  const getFinalsSummary = (): string => {
    const preset = formData.finalsConfig?.preset ?? 'none';
    switch (preset) {
      case 'none': return 'Keine';
      case 'final-only': return 'Nur Finale';
      case 'top-4': return 'HF + Finale';
      case 'top-8': return 'Mit VF';
      case 'top-16': return 'Mit AF';
      case 'all-places': return 'Alle Plätze';
    }
  };

  // Helper to get special rules summary
  const getSpecialRulesSummary = (): string => {
    if (formData.tournamentType !== 'bambini') {return 'Keine';}
    const rules: string[] = [];
    if (formData.hideScoresForPublic) {rules.push('Ergebnisse');}
    if (formData.hideRankingsForPublic) {rules.push('Tabellen');}
    if (rules.length === 0) {return 'Bambini-Modus';}
    return `Bambini (${rules.length} verborgen)`;
  };

  // Helper to get cockpit summary
  const getCockpitSummary = (): string => {
    const settings = { ...DEFAULT_MATCH_COCKPIT_SETTINGS, ...formData.matchCockpitSettings };
    const features: string[] = [];
    if (settings.soundEnabled) {features.push('Sound');}
    if (settings.hapticEnabled) {features.push('Haptik');}
    if (settings.autoFinishEnabled) {features.push('Auto');}
    if (features.length === 0) {return 'Standard';}
    return features.join(' + ');
  };

  // Get cockpit settings with defaults
  const cockpitSettings: MatchCockpitSettings = {
    ...DEFAULT_MATCH_COCKPIT_SETTINGS,
    ...formData.matchCockpitSettings,
  };

  // Handle cockpit settings change
  const handleCockpitSettingsChange = (newSettings: MatchCockpitSettings) => {
    onUpdate('matchCockpitSettings', newSettings);
  };

  return (
    <Card>
      <h2 style={{
        color: cssVars.colors.textPrimary,
        fontSize: cssVars.fontSizes.xl,
        margin: '0 0 24px 0'
      }}>
        Modus & Spielsystem
      </h2>

      {/* TOUR-EDIT-STRUCTURE: Warning banner when structure is locked */}
      {structureFieldsLocked && (
        <div style={{
          background: cssVars.colors.correctionBg,
          border: `2px solid ${cssVars.colors.correctionBorder}`,
          borderRadius: cssVars.borderRadius.md,
          padding: cssVars.spacing.md,
          marginBottom: cssVars.spacing.lg,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: cssVars.spacing.sm }}>
            <span style={{ fontSize: cssVars.fontSizes.xl }}>🔒</span>
            <div style={{ flex: 1 }}>
              <div style={{
                color: cssVars.colors.correctionText,
                fontWeight: cssVars.fontWeights.semibold,
                marginBottom: '4px'
              }}>
                Strukturänderungen gesperrt
              </div>
              <div style={{
                color: cssVars.colors.textSecondary,
                fontSize: cssVars.fontSizes.sm,
                marginBottom: cssVars.spacing.md
              }}>
                Das Turnier hat bereits Ergebnisse. Anzahl Teams, Felder und Gruppen können nicht mehr geändert werden.
              </div>
              {onResetTournament && (
                <button
                  onClick={onResetTournament}
                  style={{
                    background: cssVars.colors.dangerSubtle,
                    border: `1px solid ${cssVars.colors.dangerBorderStrong}`,
                    borderRadius: cssVars.borderRadius.sm,
                    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
                    color: cssVars.colors.error,
                    fontSize: cssVars.fontSizes.sm,
                    fontWeight: cssVars.fontWeights.medium,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: cssVars.spacing.xs,
                  }}
                  data-testid="wizard-reset-tournament"
                >
                  <span>🔄</span> Turnier zurücksetzen
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tournament Mode Selection */}
      <ModeSelection
        selectedMode={formData.mode ?? 'classic'}
        onModeChange={(mode) => onUpdate('mode', mode)}
      />

      {/* Classic Mode Configuration */}
      {formData.mode === 'classic' && (
        <>
          {/* ============================================
              SECTION 1: Grundsystem (always visible)
              ============================================ */}
          <div style={{ marginTop: '16px' }}>
            {/* Group System Select */}
            <Select
              label="Grundsystem"
              value={formData.groupSystem ?? 'roundRobin'}
              onChange={(v) => onUpdate('groupSystem', v as GroupSystem)}
              options={GROUP_SYSTEM_OPTIONS}
              disabled={structureFieldsLocked}
            />

            {/* DFB Key System */}
            <DFBKeySystem
              formData={formData}
              onUpdate={onUpdate}
            />

            {/* Basic Tournament Parameters - Responsive Grid */}
            <div className={`${styles.configGrid} ${canUseGroups ? styles.threeColumns : ''}`}>
              <NumberStepper
                label="Anzahl Teams"
                value={formData.numberOfTeams ?? 4}
                onChange={handleTeamCountChange}
                min={2}
                max={24}
                mode="stepper"
                disabled={structureFieldsLocked}
              />
              {canUseGroups && (
                <NumberStepper
                  label="Anzahl Gruppen"
                  value={formData.numberOfGroups ?? 2}
                  onChange={(v) => onUpdate('numberOfGroups', v)}
                  min={2}
                  max={8}
                  mode="stepper"
                  disabled={structureFieldsLocked}
                />
              )}
              <NumberStepper
                label={`Anzahl ${formData.sport === 'other' ? 'Spielflächen' : 'Felder'}`}
                value={formData.numberOfFields ?? 1}
                onChange={(v) => onUpdate('numberOfFields', v)}
                min={1}
                max={10}
                mode="stepper"
                disabled={structureFieldsLocked}
              />
            </div>

            {/* Duration Estimate - Always visible as it's important */}
            <DurationEstimate formData={formData} />

            {/* Validation Warnings - Always visible */}
            <ValidationWarnings formData={formData} />
          </div>

          {/* ============================================
              SMART CONFIG - Prominent Section
              ============================================ */}
          <div style={{
            marginTop: cssVars.spacing.lg,
            padding: cssVars.spacing.md,
            background: `linear-gradient(135deg, ${cssVars.colors.secondarySubtle}, ${cssVars.colors.primarySubtle})`,
            border: `2px solid ${cssVars.colors.secondaryBorderActive}`,
            borderRadius: cssVars.borderRadius.lg,
          }}>
            <p style={{
              color: cssVars.colors.textSecondary,
              fontSize: cssVars.fontSizes.xs,
              margin: `0 0 ${cssVars.spacing.sm} 0`,
              textAlign: 'center',
            }}>
              💡 Tipp: Lass dir die optimale Konfiguration berechnen
            </p>
            <SmartConfig
              formData={formData}
              onApply={(config) => {
                onUpdate('numberOfTeams', config.numberOfTeams);
                onUpdate('numberOfFields', config.numberOfFields);
                onUpdate('groupPhaseGameDuration', config.groupPhaseGameDuration);
                onUpdate('groupPhaseBreakDuration', config.groupPhaseBreakDuration);
              }}
            />
          </div>

          {/* ============================================
              SECTION DIVIDER - Erweiterte Einstellungen
              ============================================ */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: cssVars.spacing.md,
            marginTop: cssVars.spacing.xl,
            marginBottom: cssVars.spacing.sm,
          }}>
            <div style={{
              flex: 1,
              height: '1px',
              background: `linear-gradient(to right, transparent, ${cssVars.colors.border}, ${cssVars.colors.border})`,
            }} />
            <span style={{
              color: cssVars.colors.textSecondary,
              fontSize: cssVars.fontSizes.xs,
              fontWeight: cssVars.fontWeights.medium,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              whiteSpace: 'nowrap',
            }}>
              Erweiterte Einstellungen
            </span>
            <div style={{
              flex: 1,
              height: '1px',
              background: `linear-gradient(to left, transparent, ${cssVars.colors.border}, ${cssVars.colors.border})`,
            }} />
          </div>

          {/* ============================================
              SECTION 2: Zeitplanung (collapsible)
              ============================================ */}
          <CollapsibleSection
            title="Zeitplanung"
            badge={getTimeSummary()}
            defaultOpen={false}
          >
            {/* Game Time Configuration - Group Phase */}
            <GameTimeConfig
              formData={formData}
              onUpdate={onUpdate}
              phase="group"
            />

            {/* Game Time Configuration - Finals Phase */}
            {canUseGroups && (
              <GameTimeConfig
                formData={formData}
                onUpdate={onUpdate}
                phase="finals"
              />
            )}
          </CollapsibleSection>

          {/* ============================================
              SECTION 3: Tabellenregeln (collapsible)
              ============================================ */}
          <CollapsibleSection
            title="Tabellenregeln"
            badge={getPlacementSummary()}
            defaultOpen={false}
          >
            {/* Placement Logic */}
            {formData.placementLogic && (
              <PlacementLogicEditor
                placementLogic={formData.placementLogic}
                onMove={onMovePlacementLogic}
                onToggle={onTogglePlacementLogic}
                onReorder={onReorderPlacementLogic}
              />
            )}

            {/* Point System */}
            <PointSystemPicker
              formData={formData}
              onUpdate={onUpdate}
            />
          </CollapsibleSection>

          {/* ============================================
              SECTION 4: Finalrunde (collapsible, conditional)
              ============================================ */}
          {canUseGroups && (
            <CollapsibleSection
              title="Finalrunde"
              badge={getFinalsSummary()}
              variant="primary"
              defaultOpen={false}
            >
              <FinalsConfiguration
                formData={formData}
                onUpdate={onUpdate}
              />
            </CollapsibleSection>
          )}

          {/* ============================================
              SECTION 5: Schiedsrichter (collapsible)
              ============================================ */}
          <CollapsibleSection
            title="Schiedsrichter"
            badge={getRefereeSummary()}
            defaultOpen={false}
          >
            <RefereeSettings
              formData={formData}
              onUpdate={onUpdate}
            />
          </CollapsibleSection>

          {/* ============================================
              SECTION 6: Sonderregeln (collapsible)
              ============================================ */}
          <CollapsibleSection
            title="Sonderregeln"
            badge={getSpecialRulesSummary()}
            defaultOpen={false}
          >
            <BambiniSettings
              formData={formData}
              onUpdate={onUpdate}
            />
          </CollapsibleSection>

          {/* ============================================
              SECTION 7: Match Cockpit Pro (collapsible)
              ============================================ */}
          <CollapsibleSection
            title="Match Cockpit Pro"
            badge={getCockpitSummary()}
            defaultOpen={false}
            variant="primary"
          >
            <p style={{
              color: cssVars.colors.textSecondary,
              fontSize: cssVars.fontSizes.sm,
              marginBottom: cssVars.spacing.md,
            }}>
              Einstellungen für das Live-Spielverwaltungs-Cockpit: Timer, Sound, Haptik und Auto-Funktionen.
            </p>
            <MatchCockpitSettingsPanel
              settings={cockpitSettings}
              onChange={handleCockpitSettingsChange}
              tournamentId={formData.id ?? 'new'}
            />
          </CollapsibleSection>
        </>
      )}

      {/* Mini-Fußball Mode - Coming Soon */}
      {formData.mode === 'miniFussball' && (
        <div style={{
          padding: '32px',
          textAlign: 'center',
          background: cssVars.colors.secondaryBadge,
          borderRadius: cssVars.borderRadius.md,
          border: `1px solid ${cssVars.colors.secondaryBorder}`,
          marginTop: '16px',
        }}>
          <div style={{ fontSize: displaySizes.lg, marginBottom: '16px' }}>🚧</div>
          <h3 style={{
            color: cssVars.colors.textPrimary,
            fontSize: cssVars.fontSizes.xl,
            margin: '0 0 8px 0'
          }}>
            Mini-Fußball / Funino
          </h3>
          <p style={{
            color: cssVars.colors.textSecondary,
            fontSize: cssVars.fontSizes.md,
            margin: '0 0 16px 0',
            lineHeight: '1.5'
          }}>
            Dieses Feature wird in einer zukünftigen Version verfügbar sein.
            Es wird Feldrotation und spezielle Regeln für Mini-Fußball unterstützen.
          </p>
          <span style={{
            display: 'inline-block',
            padding: '6px 16px',
            background: cssVars.colors.secondarySelected,
            border: `1px solid ${cssVars.colors.secondaryBorderStrong}`,
            borderRadius: '16px',
            fontSize: cssVars.fontSizes.sm,
            fontWeight: cssVars.fontWeights.semibold,
            color: cssVars.colors.secondary,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Coming Soon
          </span>
        </div>
      )}
    </Card>
  );
};
