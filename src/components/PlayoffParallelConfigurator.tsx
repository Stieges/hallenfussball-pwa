/**
 * Playoff Parallel Configurator
 *
 * Allows configuration of which playoff matches can run in parallel
 */

import { CSSProperties } from 'react';
import { theme } from '../styles/theme';
import { PlayoffConfig, PlayoffMatchConfig, Finals } from '../types/tournament';

interface PlayoffParallelConfiguratorProps {
  numberOfFields: number;
  numberOfGroups: number;
  finals: Finals;
  playoffConfig?: PlayoffConfig;
  onUpdate: (config: PlayoffConfig) => void;
}

export const PlayoffParallelConfigurator: React.FC<PlayoffParallelConfiguratorProps> = ({
  numberOfFields,
  numberOfGroups,
  finals,
  playoffConfig,
  onUpdate,
}) => {
  // Don't show if only 1 field or no finals enabled
  if (numberOfFields < 2 || !Object.values(finals).some(Boolean)) {
    return null;
  }

  const config = playoffConfig || {
    enabled: true,
    allowParallelMatches: false,
    matches: [],
  };

  // Generate default match configurations based on current finals
  const getDefaultMatchConfigs = (): PlayoffMatchConfig[] => {
    const configs: PlayoffMatchConfig[] = [];

    // For 2 groups
    if (numberOfGroups === 2) {
      if (finals.final) {
        configs.push({
          id: 'final',
          label: 'Finale',
          parallelMode: 'sequentialOnly',
          enabled: true,
        });
      }
      if (finals.thirdPlace) {
        configs.push({
          id: 'thirdPlace',
          label: 'Spiel um Platz 3',
          parallelMode: 'parallelAllowed',
          enabled: true,
        });
      }
      if (finals.fifthSixth) {
        configs.push({
          id: 'fifthSixth',
          label: 'Spiel um Platz 5',
          parallelMode: 'parallelAllowed',
          enabled: true,
        });
      }
      if (finals.seventhEighth) {
        configs.push({
          id: 'seventhEighth',
          label: 'Spiel um Platz 7',
          parallelMode: 'parallelAllowed',
          enabled: true,
        });
      }
    }

    // For 4 groups (with semifinals)
    else if (numberOfGroups === 4) {
      configs.push({
        id: 'semi1',
        label: 'Halbfinale 1',
        parallelMode: 'parallelAllowed',
        enabled: true,
      });
      configs.push({
        id: 'semi2',
        label: 'Halbfinale 2',
        parallelMode: 'parallelAllowed',
        enabled: true,
      });

      if (finals.final) {
        configs.push({
          id: 'final',
          label: 'Finale',
          parallelMode: 'sequentialOnly',
          enabled: true,
        });
      }
      if (finals.thirdPlace) {
        configs.push({
          id: 'thirdPlace',
          label: 'Spiel um Platz 3',
          parallelMode: 'parallelAllowed',
          enabled: true,
        });
      }
    }

    return configs;
  };

  // Merge existing config with defaults
  const matchConfigs = config.matches.length > 0
    ? config.matches
    : getDefaultMatchConfigs();

  const handleGlobalToggle = () => {
    onUpdate({
      ...config,
      allowParallelMatches: !config.allowParallelMatches,
    });
  };

  const handleMatchParallelToggle = (matchId: string) => {
    const updatedMatches = matchConfigs.map(m =>
      m.id === matchId
        ? { ...m, parallelMode: m.parallelMode === 'parallelAllowed' ? 'sequentialOnly' : 'parallelAllowed' as const }
        : m
    );

    onUpdate({
      ...config,
      matches: updatedMatches,
    });
  };

  // Styles
  const containerStyle: CSSProperties = {
    marginTop: '16px',
    padding: '16px',
    background: 'rgba(0,176,255,0.08)',
    borderRadius: theme.borderRadius.md,
    border: '1px solid rgba(0,176,255,0.3)',
  };

  const headerStyle: CSSProperties = {
    fontSize: '14px',
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.secondary,
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const descStyle: CSSProperties = {
    fontSize: '12px',
    color: theme.colors.text.secondary,
    marginBottom: '16px',
  };

  const globalToggleStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    background: 'rgba(0,0,0,0.2)',
    borderRadius: theme.borderRadius.sm,
    border: `1px solid ${theme.colors.border}`,
    marginBottom: '16px',
  };

  const checkboxStyle: CSSProperties = {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
    accentColor: theme.colors.secondary,
  };

  const labelStyle: CSSProperties = {
    flex: 1,
    fontSize: '13px',
    color: theme.colors.text.primary,
    cursor: 'pointer',
  };

  const matchListStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  };

  const matchItemStyle = (isParallel: boolean): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    background: isParallel ? 'rgba(0,176,255,0.15)' : 'rgba(0,0,0,0.2)',
    borderRadius: theme.borderRadius.sm,
    border: `1px solid ${isParallel ? theme.colors.secondary : theme.colors.border}`,
    transition: 'all 0.2s ease',
  });

  const iconStyle = (isParallel: boolean): CSSProperties => ({
    fontSize: '16px',
    minWidth: '20px',
  });

  const infoStyle: CSSProperties = {
    marginTop: '12px',
    padding: '10px',
    background: 'rgba(0,176,255,0.1)',
    borderRadius: theme.borderRadius.sm,
    fontSize: '11px',
    color: theme.colors.text.secondary,
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        ⚡ Parallelisierung der Finalspiele
      </div>

      <div style={descStyle}>
        Mit {numberOfFields} Feldern können mehrere Spiele gleichzeitig stattfinden.
      </div>

      {/* Global Toggle */}
      <div style={globalToggleStyle}>
        <input
          type="checkbox"
          checked={config.allowParallelMatches}
          onChange={handleGlobalToggle}
          style={checkboxStyle}
          id="global-parallel"
        />
        <label htmlFor="global-parallel" style={labelStyle}>
          <strong>Finalspiele dürfen parallel laufen</strong>
          <div style={{ fontSize: '11px', color: theme.colors.text.secondary, marginTop: '4px' }}>
            Wenn deaktiviert, laufen alle Finalspiele nacheinander
          </div>
        </label>
      </div>

      {/* Individual Match Configuration */}
      {config.allowParallelMatches && (
        <>
          <div style={{ fontSize: '12px', fontWeight: theme.fontWeights.medium, marginBottom: '8px' }}>
            Konfiguration pro Spiel:
          </div>

          <div style={matchListStyle}>
            {matchConfigs.map(match => {
              const isParallel = match.parallelMode === 'parallelAllowed';
              return (
                <div
                  key={match.id}
                  style={matchItemStyle(isParallel)}
                  onClick={() => handleMatchParallelToggle(match.id)}
                >
                  <span style={iconStyle(isParallel)}>
                    {isParallel ? '⚡' : '⏱️'}
                  </span>
                  <span style={{ flex: 1, fontSize: '13px' }}>
                    {match.label}
                  </span>
                  <span style={{ fontSize: '11px', color: theme.colors.text.secondary }}>
                    {isParallel ? 'Parallel möglich' : 'Einzeln'}
                  </span>
                </div>
              );
            })}
          </div>

          <div style={infoStyle}>
            💡 <strong>Hinweis:</strong> Spiele mit "Parallel möglich" können gleichzeitig auf verschiedenen Feldern stattfinden,
            wenn genügend Felder verfügbar sind. "Einzeln" bedeutet, dass dieses Spiel exklusiv in einem eigenen Zeitfenster läuft.
          </div>
        </>
      )}
    </div>
  );
};
