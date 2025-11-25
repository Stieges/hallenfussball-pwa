import { CSSProperties, useState } from 'react';
import { Card, Select, Input, Icons } from '../../components/ui';
import { Tournament, GroupSystem, PlacementCriterion, PlayoffConfig } from '../../types/tournament';
import { theme } from '../../styles/theme';
import { GROUP_SYSTEM_OPTIONS, NUMBER_OF_GROUPS_OPTIONS, GAME_PERIODS_OPTIONS, DEFAULT_VALUES } from '../../constants/tournamentOptions';
import { DFB_ROUND_ROBIN_PATTERNS } from '../../constants/dfbMatchPatterns';
import { FinalRoundConfigurator } from '../../components/FinalRoundConfigurator';
import { PlayoffParallelConfigurator } from '../../components/PlayoffParallelConfigurator';

interface Step2Props {
  formData: Partial<Tournament>;
  onUpdate: <K extends keyof Tournament>(field: K, value: Tournament[K]) => void;
  onMovePlacementLogic: (index: number, direction: number) => void;
  onTogglePlacementLogic: (index: number) => void;
}

export const Step2_ModeAndSystem: React.FC<Step2Props> = ({
  formData,
  onUpdate,
  onMovePlacementLogic,
  onTogglePlacementLogic,
}) => {
  const canUseGroups = formData.groupSystem === 'groupsAndFinals';

  // State für DFB-Schlüsselsystem
  const [useDFBKeys, setUseDFBKeys] = useState(false);
  const [selectedDFBPattern, setSelectedDFBPattern] = useState('1T06M');

  // State für individuelles Punktesystem
  const [customPointSystem, setCustomPointSystem] = useState(false);

  const modeButtonStyle = (isSelected: boolean): CSSProperties => ({
    padding: '20px',
    background: isSelected ? 'rgba(0,230,118,0.2)' : 'rgba(0,0,0,0.2)',
    border: isSelected ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
    borderRadius: theme.borderRadius.md,
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 0.2s',
  });

  const pointPresetStyle = (isActive: boolean): CSSProperties => ({
    padding: '12px',
    background: isActive ? 'rgba(0,176,255,0.2)' : 'rgba(0,0,0,0.2)',
    border: isActive ? `2px solid ${theme.colors.secondary}` : '2px solid transparent',
    borderRadius: theme.borderRadius.sm,
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
  });

  return (
    <Card>
      <h2 style={{ color: theme.colors.text.primary, fontSize: theme.fontSizes.xl, margin: '0 0 24px 0' }}>
        ⚙️ Modus & Spielsystem
      </h2>

      {/* Turniermodus wählen */}
      <div style={{ marginBottom: '32px' }}>
        <label style={{ display: 'block', marginBottom: '12px', fontSize: theme.fontSizes.sm, color: theme.colors.text.secondary, fontWeight: theme.fontWeights.medium }}>
          Turniermodus
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <button onClick={() => onUpdate('mode', 'classic')} style={modeButtonStyle(formData.mode === 'classic')}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>⚽</div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: theme.colors.text.primary }}>
              Klassisches Hallenturnier
            </div>
            <div style={{ fontSize: '12px', color: theme.colors.text.secondary, marginTop: '4px' }}>
              Gruppen + Finalrunde
            </div>
          </button>
          <button onClick={() => onUpdate('mode', 'miniFussball')} style={modeButtonStyle(formData.mode === 'miniFussball')}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>🎯</div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: theme.colors.text.primary }}>
              Mini-Fußball / Funino
            </div>
            <div style={{ fontSize: '12px', color: theme.colors.text.secondary, marginTop: '4px' }}>
              Feldrotation, mehrere Felder
            </div>
          </button>
        </div>
      </div>

      {/* Classic Mode Configuration */}
      {formData.mode === 'classic' && (
        <>
          <Select
            label="Grundsystem"
            value={formData.groupSystem || 'roundRobin'}
            onChange={(v) => onUpdate('groupSystem', v as GroupSystem)}
            options={GROUP_SYSTEM_OPTIONS}
          />

          {/* DFB Schlüsselsystem Option */}
          {formData.groupSystem === 'roundRobin' && (
            <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(0,176,255,0.08)', borderRadius: theme.borderRadius.md, border: '1px solid rgba(0,176,255,0.2)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={useDFBKeys}
                  onChange={(e) => setUseDFBKeys(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: theme.colors.secondary }}
                />
                <span style={{ color: theme.colors.text.primary, fontSize: '14px', fontWeight: theme.fontWeights.medium }}>
                  📋 DFB-Schlüsselsystem verwenden
                </span>
              </label>
              <p style={{ fontSize: '12px', color: theme.colors.text.secondary, margin: '8px 0 0 30px', lineHeight: '1.4' }}>
                Verwendet die offiziellen DFB-Ansetzungsmuster für Round-Robin Turniere
              </p>

              {useDFBKeys && (
                <div style={{ marginTop: '16px' }}>
                  <Select
                    label="Ansetzungsmuster"
                    value={selectedDFBPattern}
                    onChange={(v) => setSelectedDFBPattern(v)}
                    options={DFB_ROUND_ROBIN_PATTERNS.map(pattern => ({
                      value: pattern.code,
                      label: `${pattern.code} - ${pattern.description}`
                    }))}
                  />
                </div>
              )}
            </div>
          )}

          {/* Grundlegende Turnier-Parameter */}
          <div style={{ display: 'grid', gridTemplateColumns: canUseGroups ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)', gap: '16px', marginTop: '16px' }}>
            <Input
              label="Anzahl Teams"
              type="number"
              min="2"
              max="64"
              value={formData.numberOfTeams || 4}
              onChange={(v) => onUpdate('numberOfTeams', parseInt(v) || 4)}
              required
            />
            {canUseGroups && (
              <Select
                label="Anzahl Gruppen"
                value={formData.numberOfGroups || 2}
                onChange={(v) => onUpdate('numberOfGroups', parseInt(v))}
                options={NUMBER_OF_GROUPS_OPTIONS}
              />
            )}
            <Input
              label={`Anzahl ${formData.sport === 'other' ? 'Spielflächen' : 'Felder'}`}
              type="number"
              min="1"
              max="10"
              value={formData.numberOfFields || 1}
              onChange={(v) => onUpdate('numberOfFields', parseInt(v) || 1)}
            />
          </div>

          {/* Spielzeit-Konfiguration Gruppenphase */}
          <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(0,230,118,0.05)', borderRadius: theme.borderRadius.md, border: '1px solid rgba(0,230,118,0.15)' }}>
            <h4 style={{ color: theme.colors.primary, fontSize: '13px', margin: '0 0 12px 0', fontWeight: theme.fontWeights.semibold }}>
              ⏱️ Gruppenphase - Spielzeit-Einstellungen
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <Input
                label="Spieldauer (Min.)"
                type="number"
                min="1"
                max="90"
                value={formData.groupPhaseGameDuration ?? DEFAULT_VALUES.groupPhaseGameDuration}
                onChange={(v) => onUpdate('groupPhaseGameDuration', parseInt(v) || 10)}
              />
              <Input
                label="Pause zwischen Spielen (Min.)"
                type="number"
                min="0"
                max="30"
                value={formData.groupPhaseBreakDuration ?? DEFAULT_VALUES.groupPhaseBreakDuration}
                onChange={(v) => onUpdate('groupPhaseBreakDuration', parseInt(v) || 0)}
              />
              <Select
                label="Spielabschnitte"
                value={formData.gamePeriods ?? DEFAULT_VALUES.gamePeriods}
                onChange={(v) => onUpdate('gamePeriods', parseInt(v))}
                options={GAME_PERIODS_OPTIONS}
              />
            </div>
            {(formData.gamePeriods ?? DEFAULT_VALUES.gamePeriods) > 1 && (
              <div style={{ marginTop: '16px' }}>
                <Input
                  label="Halbzeitpause (Min.)"
                  type="number"
                  min="0"
                  max="10"
                  value={formData.halftimeBreak ?? DEFAULT_VALUES.halftimeBreak}
                  onChange={(v) => onUpdate('halftimeBreak', parseInt(v) || 1)}
                />
                <p style={{ fontSize: '11px', color: theme.colors.text.secondary, marginTop: '8px', lineHeight: '1.4' }}>
                  💡 Das Spiel wird in {formData.gamePeriods} Abschnitte à {Math.floor((formData.groupPhaseGameDuration ?? 10) / (formData.gamePeriods || 1))} Min. unterteilt
                </p>
              </div>
            )}
          </div>

          {/* Spielzeit-Konfiguration Finalrunde */}
          {canUseGroups && (
            <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(255,215,0,0.08)', borderRadius: theme.borderRadius.md, border: '1px solid rgba(255,215,0,0.3)' }}>
              <h4 style={{ color: theme.colors.accent, fontSize: '13px', margin: '0 0 12px 0', fontWeight: theme.fontWeights.semibold }}>
                🏆 Finalrunde - Spielzeit-Einstellungen
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                <Input
                  label="Spieldauer (Min.)"
                  type="number"
                  min="1"
                  max="90"
                  value={formData.finalRoundGameDuration ?? DEFAULT_VALUES.finalRoundGameDuration}
                  onChange={(v) => onUpdate('finalRoundGameDuration', parseInt(v) || 10)}
                />
                <Input
                  label="Pause zwischen Spielen (Min.)"
                  type="number"
                  min="0"
                  max="30"
                  value={formData.finalRoundBreakDuration ?? DEFAULT_VALUES.finalRoundBreakDuration}
                  onChange={(v) => onUpdate('finalRoundBreakDuration', parseInt(v) || 0)}
                />
                <Input
                  label="Pause bis Finalrunde (Min.)"
                  type="number"
                  min="0"
                  max="60"
                  value={formData.breakBetweenPhases ?? DEFAULT_VALUES.breakBetweenPhases}
                  onChange={(v) => onUpdate('breakBetweenPhases', parseInt(v) || 5)}
                />
              </div>
              <p style={{ fontSize: '11px', color: theme.colors.text.secondary, marginTop: '8px', lineHeight: '1.4' }}>
                💡 Die Spielabschnitt-Einstellungen gelten auch für die Finalrunde
              </p>
            </div>
          )}

          {/* Placement Logic */}
          <div style={{ marginTop: '24px' }}>
            <h3 style={{ color: theme.colors.primary, fontSize: '14px', margin: '0 0 16px 0' }}>
              📊 Platzierungslogik
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {formData.placementLogic?.map((criterion: PlacementCriterion, index: number) => (
                <div
                  key={criterion.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    background: criterion.enabled ? 'rgba(0,230,118,0.1)' : 'rgba(0,0,0,0.2)',
                    border: criterion.enabled ? '1px solid rgba(0,230,118,0.3)' : '1px solid transparent',
                    borderRadius: '10px',
                    opacity: criterion.enabled ? 1 : 0.5,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <button
                      onClick={() => onMovePlacementLogic(index, -1)}
                      disabled={index === 0}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: theme.colors.text.secondary,
                        cursor: index === 0 ? 'not-allowed' : 'pointer',
                        padding: '0',
                        opacity: index === 0 ? 0.3 : 1,
                      }}
                    >
                      <Icons.ArrowUp />
                    </button>
                    <button
                      onClick={() => onMovePlacementLogic(index, 1)}
                      disabled={index === (formData.placementLogic?.length || 0) - 1}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: theme.colors.text.secondary,
                        cursor: index === (formData.placementLogic?.length || 0) - 1 ? 'not-allowed' : 'pointer',
                        padding: '0',
                        opacity: index === (formData.placementLogic?.length || 0) - 1 ? 0.3 : 1,
                      }}
                    >
                      <Icons.ArrowDown />
                    </button>
                  </div>
                  <span style={{ fontFamily: theme.fonts.heading, fontSize: '18px', color: theme.colors.primary, minWidth: '24px' }}>
                    {index + 1}
                  </span>
                  <span style={{ flex: 1, color: theme.colors.text.primary, fontSize: '14px' }}>
                    {criterion.label}
                  </span>
                  <button
                    onClick={() => onTogglePlacementLogic(index)}
                    style={{
                      padding: '6px 12px',
                      background: criterion.enabled ? theme.colors.primary : 'rgba(255,255,255,0.1)',
                      border: 'none',
                      borderRadius: '6px',
                      color: criterion.enabled ? theme.colors.background : theme.colors.text.secondary,
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    {criterion.enabled ? 'Aktiv' : 'Inaktiv'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Finalrunden-Konfiguration */}
          {canUseGroups && formData.finals && (
            <>
              <FinalRoundConfigurator
                numberOfGroups={formData.numberOfGroups || 2}
                finals={formData.finals}
                onUpdate={(finals) => onUpdate('finals', finals)}
              />

              {/* Playoff Parallelisierungs-Konfiguration */}
              <PlayoffParallelConfigurator
                numberOfFields={formData.numberOfFields || 1}
                numberOfGroups={formData.numberOfGroups || 2}
                finals={formData.finals}
                playoffConfig={formData.playoffConfig}
                onUpdate={(config: PlayoffConfig) => onUpdate('playoffConfig', config)}
              />
            </>
          )}

          {/* Point System */}
          <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: `1px solid ${theme.colors.border}` }}>
            <h3 style={{ color: theme.colors.secondary, fontSize: '14px', margin: '0 0 16px 0' }}>
              🎯 Punktesystem
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
              <button
                onClick={() => {
                  setCustomPointSystem(false);
                  onUpdate('pointSystem', { win: 3, draw: 1, loss: 0 });
                }}
                style={pointPresetStyle(
                  !customPointSystem && formData.pointSystem?.win === 3 && formData.pointSystem?.draw === 1 && formData.pointSystem?.loss === 0
                )}
              >
                <div style={{ fontSize: '16px', fontWeight: '700', color: theme.colors.text.primary }}>3-1-0</div>
                <div style={{ fontSize: '11px', color: theme.colors.text.secondary, marginTop: '2px' }}>Standard</div>
              </button>
              <button
                onClick={() => {
                  setCustomPointSystem(false);
                  onUpdate('pointSystem', { win: 2, draw: 1, loss: 0 });
                }}
                style={pointPresetStyle(
                  !customPointSystem && formData.pointSystem?.win === 2 && formData.pointSystem?.draw === 1 && formData.pointSystem?.loss === 0
                )}
              >
                <div style={{ fontSize: '16px', fontWeight: '700', color: theme.colors.text.primary }}>2-1-0</div>
                <div style={{ fontSize: '11px', color: theme.colors.text.secondary, marginTop: '2px' }}>Klassisch</div>
              </button>
              <button
                onClick={() => {
                  setCustomPointSystem(false);
                  onUpdate('pointSystem', { win: 3, draw: 0, loss: 0 });
                }}
                style={pointPresetStyle(
                  !customPointSystem && formData.pointSystem?.win === 3 && formData.pointSystem?.draw === 0 && formData.pointSystem?.loss === 0
                )}
              >
                <div style={{ fontSize: '16px', fontWeight: '700', color: theme.colors.text.primary }}>3-0-0</div>
                <div style={{ fontSize: '11px', color: theme.colors.text.secondary, marginTop: '2px' }}>Nur Siege</div>
              </button>
              <button
                onClick={() => setCustomPointSystem(!customPointSystem)}
                style={pointPresetStyle(customPointSystem)}
              >
                <div style={{ fontSize: '16px', fontWeight: '700', color: theme.colors.text.primary }}>⚙️</div>
                <div style={{ fontSize: '11px', color: theme.colors.text.secondary, marginTop: '2px' }}>Individuell</div>
              </button>
            </div>

            {/* Custom Point System Inputs */}
            {customPointSystem && (
              <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(0,176,255,0.08)', borderRadius: theme.borderRadius.md, border: '1px solid rgba(0,176,255,0.2)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: theme.fontSizes.sm, color: theme.colors.text.secondary, fontWeight: theme.fontWeights.medium }}>
                      Sieg
                    </label>
                    <Input
                      type="number"
                      step="0.5"
                      value={formData.pointSystem?.win ?? 3}
                      onChange={(v) => onUpdate('pointSystem', {
                        ...formData.pointSystem,
                        win: parseFloat(v) || 0
                      } as any)}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: theme.fontSizes.sm, color: theme.colors.text.secondary, fontWeight: theme.fontWeights.medium }}>
                      Unentschieden
                    </label>
                    <Input
                      type="number"
                      step="0.5"
                      value={formData.pointSystem?.draw ?? 1}
                      onChange={(v) => onUpdate('pointSystem', {
                        ...formData.pointSystem,
                        draw: parseFloat(v) || 0
                      } as any)}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: theme.fontSizes.sm, color: theme.colors.text.secondary, fontWeight: theme.fontWeights.medium }}>
                      Niederlage
                    </label>
                    <Input
                      type="number"
                      step="0.5"
                      value={formData.pointSystem?.loss ?? 0}
                      onChange={(v) => onUpdate('pointSystem', {
                        ...formData.pointSystem,
                        loss: parseFloat(v) || 0
                      } as any)}
                    />
                  </div>
                </div>
                <p style={{ fontSize: '11px', color: theme.colors.text.secondary, marginTop: '12px', lineHeight: '1.4' }}>
                  💡 Erlaubt sind positive, negative Zahlen und Null. Auch Kommazahlen sind möglich (z.B. 2.5)
                </p>
              </div>
            )}
          </div>

          {/* Bambini Settings Accordion */}
          {formData.tournamentType === 'bambini' && (
            <details style={{ marginTop: '24px' }}>
              <summary
                style={{
                  padding: '16px',
                  background: 'rgba(255,145,0,0.1)',
                  borderRadius: theme.borderRadius.md,
                  border: '1px solid rgba(255,145,0,0.3)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: theme.fontWeights.semibold,
                  color: theme.colors.warning,
                }}
              >
                👶 Erweiterte Bambini-Einstellungen
              </summary>
              <div style={{ padding: '16px', marginTop: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: theme.borderRadius.md }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.hideScoresForPublic || false}
                    onChange={(e) => onUpdate('hideScoresForPublic', e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: theme.colors.warning }}
                  />
                  <span style={{ color: theme.colors.text.primary, fontSize: '13px' }}>Ergebnisse für Zuschauer verbergen</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.hideRankingsForPublic || false}
                    onChange={(e) => onUpdate('hideRankingsForPublic', e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: theme.colors.warning }}
                  />
                  <span style={{ color: theme.colors.text.primary, fontSize: '13px' }}>Tabellen für Zuschauer verbergen</span>
                </label>
              </div>
            </details>
          )}
        </>
      )}

      {/* Mini-Fussball Mode Configuration */}
      {formData.mode === 'miniFussball' && (
        <div>
          <p style={{ color: theme.colors.text.secondary }}>
            Mini-Fußball Konfiguration folgt...
          </p>
        </div>
      )}
    </Card>
  );
};
