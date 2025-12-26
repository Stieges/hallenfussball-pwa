import { Card, Select, NumberStepper, CollapsibleSection } from '../../components/ui';
import { Tournament, GroupSystem, PlacementCriterion } from '../../types/tournament';
import { borderRadius, colors, fontSizes, fontWeights, spacing } from '../../design-tokens';
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
      const count = formData.refereeConfig?.numberOfReferees || 0;
      return `${count} SR`;
    }
    if (mode === 'teams') {return 'Teams stellen SR';}
    return '';
  };

  return (
    <Card>
      <h2 style={{
        color: colors.textPrimary,
        fontSize: fontSizes.xl,
        margin: '0 0 24px 0'
      }}>
        Modus & Spielsystem
      </h2>

      {/* TOUR-EDIT-STRUCTURE: Warning banner when structure is locked */}
      {structureFieldsLocked && (
        <div style={{
          background: colors.correctionBg,
          border: `2px solid ${colors.correctionBorder}`,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          marginBottom: spacing.lg,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing.sm }}>
            <span style={{ fontSize: '20px' }}>🔒</span>
            <div style={{ flex: 1 }}>
              <div style={{
                color: colors.correctionText,
                fontWeight: fontWeights.semibold,
                marginBottom: '4px'
              }}>
                Strukturänderungen gesperrt
              </div>
              <div style={{
                color: colors.textSecondary,
                fontSize: fontSizes.sm,
                marginBottom: spacing.md
              }}>
                Das Turnier hat bereits Ergebnisse. Anzahl Teams, Felder und Gruppen können nicht mehr geändert werden.
              </div>
              {onResetTournament && (
                <button
                  onClick={onResetTournament}
                  style={{
                    background: 'rgba(244, 67, 54, 0.15)',
                    border: '1px solid rgba(244, 67, 54, 0.4)',
                    borderRadius: borderRadius.sm,
                    padding: `${spacing.sm} ${spacing.md}`,
                    color: '#F44336',
                    fontSize: fontSizes.sm,
                    fontWeight: fontWeights.medium,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.xs,
                  }}
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
        selectedMode={formData.mode || 'classic'}
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
              value={formData.groupSystem || 'roundRobin'}
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
                value={formData.numberOfTeams || 4}
                onChange={handleTeamCountChange}
                min={2}
                max={24}
                mode="stepper"
                disabled={structureFieldsLocked}
              />
              {canUseGroups && (
                <NumberStepper
                  label="Anzahl Gruppen"
                  value={formData.numberOfGroups || 2}
                  onChange={(v) => onUpdate('numberOfGroups', v)}
                  min={2}
                  max={8}
                  mode="stepper"
                  disabled={structureFieldsLocked}
                />
              )}
              <NumberStepper
                label={`Anzahl ${formData.sport === 'other' ? 'Spielflächen' : 'Felder'}`}
                value={formData.numberOfFields || 1}
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
              SECTION 2: Zeitplanung (collapsible)
              ============================================ */}
          <CollapsibleSection
            title="Zeitplanung"
            defaultOpen={true}
          >
            {/* Smart Config */}
            <SmartConfig
              formData={formData}
              onApply={(config) => {
                onUpdate('numberOfTeams', config.numberOfTeams);
                onUpdate('numberOfFields', config.numberOfFields);
                onUpdate('groupPhaseGameDuration', config.groupPhaseGameDuration);
                onUpdate('groupPhaseBreakDuration', config.groupPhaseBreakDuration);
              }}
            />

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
            defaultOpen={false}
          >
            <BambiniSettings
              formData={formData}
              onUpdate={onUpdate}
            />
          </CollapsibleSection>
        </>
      )}

      {/* Mini-Fußball Mode - Coming Soon */}
      {formData.mode === 'miniFussball' && (
        <div style={{
          padding: '32px',
          textAlign: 'center',
          background: 'rgba(0,176,255,0.08)',
          borderRadius: borderRadius.md,
          border: '1px solid rgba(0,176,255,0.2)',
          marginTop: '16px',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚧</div>
          <h3 style={{
            color: colors.textPrimary,
            fontSize: '18px',
            margin: '0 0 8px 0'
          }}>
            Mini-Fußball / Funino
          </h3>
          <p style={{
            color: colors.textSecondary,
            fontSize: '14px',
            margin: '0 0 16px 0',
            lineHeight: '1.5'
          }}>
            Dieses Feature wird in einer zukünftigen Version verfügbar sein.
            Es wird Feldrotation und spezielle Regeln für Mini-Fußball unterstützen.
          </p>
          <span style={{
            display: 'inline-block',
            padding: '6px 16px',
            background: 'rgba(0,176,255,0.2)',
            border: '1px solid rgba(0,176,255,0.4)',
            borderRadius: '16px',
            fontSize: '12px',
            fontWeight: fontWeights.semibold,
            color: colors.secondary,
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
