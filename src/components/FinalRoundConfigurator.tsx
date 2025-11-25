import { CSSProperties, useState, useEffect } from 'react';
import { theme } from '../styles/theme';
import { Finals } from '../types/tournament';

interface FinalRoundConfiguratorProps {
  numberOfGroups: number;
  finals: Finals;
  onUpdate: (finals: Finals) => void;
}

type PresetType = 'none' | 'finalOnly' | 'top4' | 'top8' | 'allPlacements' | 'custom';

interface PlacementMatchConfig {
  id: keyof Finals;
  label: string;
  description: string;
  requiresQuarterfinal?: boolean;
  requiresSemifinal?: boolean;
}

const PLACEMENT_MATCHES: PlacementMatchConfig[] = [
  { id: 'final', label: 'Finale', description: 'Spiel um Platz 1' },
  { id: 'thirdPlace', label: 'Platz 3/4', description: 'Spiel um Platz 3', requiresSemifinal: true },
  { id: 'fifthSixth', label: 'Platz 5/6', description: 'Spiel um Platz 5', requiresQuarterfinal: true },
  { id: 'seventhEighth', label: 'Platz 7/8', description: 'Spiel um Platz 7', requiresQuarterfinal: true },
];

export const FinalRoundConfigurator: React.FC<FinalRoundConfiguratorProps> = ({
  numberOfGroups,
  finals,
  onUpdate,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<PresetType>('custom');
  const [hasQuarterfinal, setHasQuarterfinal] = useState(false);
  const [hasSemifinal, setHasSemifinal] = useState(true);

  // Bestimme verfügbare Presets basierend auf Gruppenanzahl
  const availablePresets = getAvailablePresets(numberOfGroups);

  // Erkenne aktuelles Preset basierend auf Finals-Konfiguration
  useEffect(() => {
    const detectedPreset = detectPreset(finals, hasQuarterfinal, hasSemifinal);
    setSelectedPreset(detectedPreset);
  }, [finals, hasQuarterfinal, hasSemifinal]);

  const handlePresetChange = (preset: PresetType) => {
    setSelectedPreset(preset);

    switch (preset) {
      case 'none':
        setHasQuarterfinal(false);
        setHasSemifinal(false);
        onUpdate({ final: false, thirdPlace: false, fifthSixth: false, seventhEighth: false });
        break;

      case 'finalOnly':
        setHasQuarterfinal(false);
        setHasSemifinal(numberOfGroups > 2);
        onUpdate({ final: true, thirdPlace: false, fifthSixth: false, seventhEighth: false });
        break;

      case 'top4':
        setHasQuarterfinal(false);
        setHasSemifinal(true);
        onUpdate({ final: true, thirdPlace: true, fifthSixth: false, seventhEighth: false });
        break;

      case 'top8':
        setHasQuarterfinal(true);
        setHasSemifinal(true);
        onUpdate({ final: true, thirdPlace: true, fifthSixth: true, seventhEighth: true });
        break;

      case 'allPlacements':
        setHasQuarterfinal(true);
        setHasSemifinal(true);
        onUpdate({ final: true, thirdPlace: true, fifthSixth: true, seventhEighth: true });
        break;

      case 'custom':
        // Behalte aktuelle Konfiguration
        break;
    }
  };

  const handleMatchToggle = (matchId: keyof Finals) => {
    const newFinals = { ...finals, [matchId]: !finals[matchId] };
    onUpdate(newFinals);
  };

  const handlePhaseToggle = (phase: 'quarterfinal' | 'semifinal') => {
    if (phase === 'quarterfinal') {
      const newValue = !hasQuarterfinal;
      setHasQuarterfinal(newValue);

      // Wenn Viertelfinale deaktiviert, deaktiviere auch abhängige Platzierungsspiele
      if (!newValue) {
        onUpdate({
          ...finals,
          fifthSixth: false,
          seventhEighth: false,
        });
      }
    } else {
      const newValue = !hasSemifinal;
      setHasSemifinal(newValue);

      // Wenn Halbfinale deaktiviert, deaktiviere auch abhängige Platzierungsspiele
      if (!newValue) {
        onUpdate({
          ...finals,
          thirdPlace: false,
        });
      }
    }
  };

  // Styles
  const containerStyle: CSSProperties = {
    marginTop: '16px',
    padding: '20px',
    background: 'rgba(255,215,0,0.08)',
    borderRadius: theme.borderRadius.md,
    border: '1px solid rgba(255,215,0,0.3)',
  };

  const headerStyle: CSSProperties = {
    color: theme.colors.accent,
    fontSize: '14px',
    margin: '0 0 16px 0',
    fontWeight: theme.fontWeights.semibold,
  };

  const presetGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '12px',
    marginBottom: '20px',
  };

  const presetButtonStyle = (isActive: boolean): CSSProperties => ({
    padding: '12px 16px',
    background: isActive ? 'rgba(255,215,0,0.2)' : 'rgba(0,0,0,0.3)',
    border: `2px solid ${isActive ? theme.colors.accent : theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    color: theme.colors.text.primary,
    fontSize: '13px',
    fontWeight: theme.fontWeights.medium,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textAlign: 'left',
  });

  const sectionStyle: CSSProperties = {
    marginTop: '16px',
    padding: '16px',
    background: 'rgba(0,0,0,0.2)',
    borderRadius: theme.borderRadius.md,
    border: `1px solid ${theme.colors.border}`,
  };

  const phaseHeaderStyle: CSSProperties = {
    fontSize: '13px',
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.text.primary,
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const checkboxRowStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 0',
    borderBottom: `1px solid ${theme.colors.border}`,
  };

  const checkboxStyle: CSSProperties = {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
    accentColor: theme.colors.accent,
  };

  const labelStyle: CSSProperties = {
    flex: 1,
    fontSize: '13px',
    color: theme.colors.text.primary,
    cursor: 'pointer',
  };

  const descriptionStyle: CSSProperties = {
    fontSize: '11px',
    color: theme.colors.text.secondary,
  };

  const bracketPreviewStyle: CSSProperties = {
    marginTop: '20px',
    padding: '16px',
    background: 'rgba(0,176,255,0.05)',
    borderRadius: theme.borderRadius.md,
    border: '1px solid rgba(0,176,255,0.15)',
  };

  const bracketTitleStyle: CSSProperties = {
    fontSize: '13px',
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.secondary,
    marginBottom: '12px',
  };

  const phaseBoxStyle: CSSProperties = {
    display: 'inline-block',
    padding: '6px 12px',
    margin: '4px',
    background: 'rgba(0,230,118,0.15)',
    borderRadius: theme.borderRadius.sm,
    fontSize: '11px',
    color: theme.colors.primary,
    fontWeight: theme.fontWeights.medium,
  };

  const warningStyle: CSSProperties = {
    marginTop: '12px',
    padding: '10px 12px',
    background: 'rgba(255,69,58,0.1)',
    borderRadius: theme.borderRadius.sm,
    border: '1px solid rgba(255,69,58,0.3)',
    fontSize: '11px',
    color: theme.colors.error,
    lineHeight: '1.4',
  };

  const infoStyle: CSSProperties = {
    fontSize: '11px',
    color: theme.colors.text.secondary,
    marginTop: '8px',
    lineHeight: '1.4',
  };

  // Validierung: Prüfe ob Konfiguration gültig ist
  const validation = validateConfiguration(numberOfGroups, finals, hasQuarterfinal, hasSemifinal);

  return (
    <div style={containerStyle}>
      <h4 style={headerStyle}>🏆 Finalrunden-Konfiguration</h4>

      {/* Preset-Auswahl */}
      <div style={presetGridStyle}>
        {availablePresets.map((preset) => (
          <button
            key={preset.value}
            onClick={() => handlePresetChange(preset.value)}
            style={presetButtonStyle(selectedPreset === preset.value)}
          >
            <div style={{ fontSize: '16px', marginBottom: '4px' }}>{preset.icon}</div>
            <div style={{ fontWeight: theme.fontWeights.semibold }}>{preset.label}</div>
            <div style={{ fontSize: '10px', color: theme.colors.text.secondary, marginTop: '2px' }}>
              {preset.description}
            </div>
          </button>
        ))}
      </div>

      {/* Custom Konfiguration */}
      {selectedPreset === 'custom' && (
        <>
          {/* Turnierphasen */}
          <div style={sectionStyle}>
            <div style={phaseHeaderStyle}>
              🎪 Turnierphasen
            </div>

            {/* Halbfinale */}
            <div style={checkboxRowStyle}>
              <input
                type="checkbox"
                checked={hasSemifinal}
                onChange={() => handlePhaseToggle('semifinal')}
                style={checkboxStyle}
                id="phase-semifinal"
              />
              <label htmlFor="phase-semifinal" style={labelStyle}>
                <div>Halbfinale</div>
                <div style={descriptionStyle}>2 Spiele (Sieger ins Finale)</div>
              </label>
            </div>

            {/* Viertelfinale */}
            <div style={{ ...checkboxRowStyle, borderBottom: 'none' }}>
              <input
                type="checkbox"
                checked={hasQuarterfinal}
                onChange={() => handlePhaseToggle('quarterfinal')}
                style={checkboxStyle}
                id="phase-quarterfinal"
              />
              <label htmlFor="phase-quarterfinal" style={labelStyle}>
                <div>Viertelfinale</div>
                <div style={descriptionStyle}>4 Spiele (Sieger ins Halbfinale)</div>
              </label>
            </div>

            {hasQuarterfinal && !hasSemifinal && (
              <div style={warningStyle}>
                ⚠️ Viertelfinale erfordert ein Halbfinale
              </div>
            )}
          </div>

          {/* Platzierungsspiele */}
          <div style={sectionStyle}>
            <div style={phaseHeaderStyle}>
              🥇 Platzierungsspiele
            </div>

            {PLACEMENT_MATCHES.map((match, index) => {
              const isDisabled =
                (match.requiresQuarterfinal && !hasQuarterfinal) ||
                (match.requiresSemifinal && !hasSemifinal);

              return (
                <div
                  key={match.id}
                  style={{
                    ...checkboxRowStyle,
                    borderBottom: index === PLACEMENT_MATCHES.length - 1 ? 'none' : checkboxRowStyle.borderBottom,
                    opacity: isDisabled ? 0.5 : 1,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={finals[match.id]}
                    onChange={() => handleMatchToggle(match.id)}
                    disabled={isDisabled}
                    style={checkboxStyle}
                    id={`match-${match.id}`}
                  />
                  <label
                    htmlFor={`match-${match.id}`}
                    style={{
                      ...labelStyle,
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <div>{match.label}</div>
                    <div style={descriptionStyle}>
                      {match.description}
                      {isDisabled && match.requiresQuarterfinal && ' (benötigt Viertelfinale)'}
                      {isDisabled && match.requiresSemifinal && !match.requiresQuarterfinal && ' (benötigt Halbfinale)'}
                    </div>
                  </label>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Validierungs-Fehler */}
      {!validation.valid && (
        <div style={warningStyle}>
          ⚠️ {validation.error}
        </div>
      )}

      {/* Bracket Preview */}
      {validation.valid && (finals.final || hasSemifinal || hasQuarterfinal) && (
        <div style={bracketPreviewStyle}>
          <div style={bracketTitleStyle}>📊 Turnierbaum-Vorschau</div>
          <div>
            {hasQuarterfinal && <span style={phaseBoxStyle}>Viertelfinale (4 Spiele)</span>}
            {hasSemifinal && <span style={phaseBoxStyle}>Halbfinale (2 Spiele)</span>}
            {finals.final && <span style={phaseBoxStyle}>🏆 Finale</span>}
            {finals.thirdPlace && <span style={phaseBoxStyle}>🥉 Platz 3/4</span>}
            {finals.fifthSixth && <span style={phaseBoxStyle}>Platz 5/6</span>}
            {finals.seventhEighth && <span style={phaseBoxStyle}>Platz 7/8</span>}
          </div>
          <div style={infoStyle}>
            💡 Insgesamt {calculateTotalMatches(finals, hasQuarterfinal, hasSemifinal)} Finalrunden-Spiele
            {numberOfGroups > 2 && finals.final && !hasSemifinal && ' (Hinweis: Bei >2 Gruppen wird empfohlen, ein Halbfinale zu spielen)'}
          </div>
        </div>
      )}
    </div>
  );
};

// Helper Functions

interface PresetOption {
  value: PresetType;
  label: string;
  description: string;
  icon: string;
  minGroups?: number;
}

function getAvailablePresets(numberOfGroups: number): PresetOption[] {
  const basePresets: PresetOption[] = [
    {
      value: 'none',
      label: 'Keine Finalrunde',
      description: 'Nur Gruppenphase',
      icon: '🚫',
    },
    {
      value: 'finalOnly',
      label: 'Nur Finale',
      description: 'Gruppensieger ins Finale',
      icon: '🏆',
    },
    {
      value: 'top4',
      label: 'Top 4',
      description: 'HF + Finale + Platz 3/4',
      icon: '🥇',
    },
    {
      value: 'top8',
      label: 'Top 8',
      description: 'VF + HF + alle Platzierungen',
      icon: '🎯',
      minGroups: 2,
    },
    {
      value: 'custom',
      label: 'Individuell',
      description: 'Eigene Konfiguration',
      icon: '⚙️',
    },
  ];

  return basePresets.filter(preset => !preset.minGroups || numberOfGroups >= preset.minGroups);
}

function detectPreset(
  finals: Finals,
  hasQuarterfinal: boolean,
  hasSemifinal: boolean
): PresetType {
  // Keine Finalrunde
  if (!finals.final && !finals.thirdPlace && !finals.fifthSixth && !finals.seventhEighth) {
    return 'none';
  }

  // Nur Finale
  if (finals.final && !finals.thirdPlace && !finals.fifthSixth && !finals.seventhEighth && !hasQuarterfinal) {
    return 'finalOnly';
  }

  // Top 4
  if (finals.final && finals.thirdPlace && !finals.fifthSixth && !finals.seventhEighth && !hasQuarterfinal && hasSemifinal) {
    return 'top4';
  }

  // Top 8
  if (finals.final && finals.thirdPlace && finals.fifthSixth && finals.seventhEighth && hasQuarterfinal && hasSemifinal) {
    return 'top8';
  }

  // Alles andere ist custom
  return 'custom';
}

function validateConfiguration(
  numberOfGroups: number,
  finals: Finals,
  hasQuarterfinal: boolean,
  hasSemifinal: boolean
): { valid: boolean; error?: string } {
  // Viertelfinale ohne Halbfinale
  if (hasQuarterfinal && !hasSemifinal) {
    return { valid: false, error: 'Viertelfinale erfordert ein Halbfinale' };
  }

  // Finale mit >2 Gruppen ohne Halbfinale
  if (finals.final && numberOfGroups > 2 && !hasSemifinal) {
    return { valid: false, error: 'Finale mit mehr als 2 Gruppen erfordert ein Halbfinale' };
  }

  // Spiel um Platz 3 ohne Halbfinale
  if (finals.thirdPlace && !hasSemifinal) {
    return { valid: false, error: 'Spiel um Platz 3 erfordert ein Halbfinale' };
  }

  // Platz 5/6 ohne Viertelfinale
  if (finals.fifthSixth && !hasQuarterfinal) {
    return { valid: false, error: 'Spiel um Platz 5/6 erfordert ein Viertelfinale' };
  }

  // Platz 7/8 ohne Viertelfinale
  if (finals.seventhEighth && !hasQuarterfinal) {
    return { valid: false, error: 'Spiel um Platz 7/8 erfordert ein Viertelfinale' };
  }

  return { valid: true };
}

function calculateTotalMatches(
  finals: Finals,
  hasQuarterfinal: boolean,
  hasSemifinal: boolean
): number {
  let total = 0;

  if (hasQuarterfinal) total += 4;
  if (hasSemifinal) total += 2;
  if (finals.final) total += 1;
  if (finals.thirdPlace) total += 1;
  if (finals.fifthSixth) total += 1;
  if (finals.seventhEighth) total += 1;

  return total;
}
