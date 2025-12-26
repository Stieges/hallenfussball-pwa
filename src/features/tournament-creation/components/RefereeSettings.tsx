import { CSSProperties } from 'react';
import { Select, Input, NumberStepper } from '../../../components/ui';
import { borderRadius, colors, fontWeights, spacing } from '../../../design-tokens';
import { Tournament, RefereeMode, FinalsRefereeMode, RefereeConfig } from '../../../types/tournament';

interface RefereeSettingsProps {
  formData: Partial<Tournament>;
  onUpdate: <K extends keyof Tournament>(field: K, value: Tournament[K]) => void;
}

export const RefereeSettings: React.FC<RefereeSettingsProps> = ({
  formData,
  onUpdate,
}) => {
  const refereeConfig = formData.refereeConfig;
  const mode = refereeConfig?.mode || 'none';
  const showFinalsOptions = mode === 'teams' && formData.groupSystem === 'groupsAndFinals';

  const handleModeChange = (newMode: string) => {
    const newConfig: RefereeConfig = {
      ...refereeConfig,
      mode: newMode as RefereeMode,
    };

    // Initialize defaults when switching to organizer mode
    if (newMode === 'organizer' && !refereeConfig?.numberOfReferees) {
      newConfig.numberOfReferees = 2;
      newConfig.maxConsecutiveMatches = 1;
    }

    onUpdate('refereeConfig', newConfig);
  };

  const handleNumberChange = (field: 'numberOfReferees' | 'maxConsecutiveMatches', value: number) => {
    const newConfig: RefereeConfig = {
      ...refereeConfig,
      mode: 'organizer',
      [field]: value,
    };

    // Adjust referee names if number changes
    if (field === 'numberOfReferees' && refereeConfig?.refereeNames) {
      const updatedNames: Record<number, string> = {};
      for (let i = 1; i <= value; i++) {
        updatedNames[i] = refereeConfig.refereeNames[i] || '';
      }
      newConfig.refereeNames = updatedNames;
    }

    onUpdate('refereeConfig', newConfig);
  };

  const handleNamesToggle = (enabled: boolean) => {
    const numberOfRefs = refereeConfig?.numberOfReferees || 2;

    if (enabled) {
      const names: Record<number, string> = {};
      for (let i = 1; i <= numberOfRefs; i++) {
        names[i] = '';
      }
      onUpdate('refereeConfig', {
        ...refereeConfig,
        mode: 'organizer',
        refereeNames: names,
      } as RefereeConfig);
    } else {
      // Remove names but keep other config
      const { refereeNames: _refereeNames, ...rest } = refereeConfig || {};
      onUpdate('refereeConfig', rest as RefereeConfig);
    }
  };

  const handleNameChange = (refNumber: number, name: string) => {
    const updatedNames = {
      ...(refereeConfig?.refereeNames || {}),
      [refNumber]: name,
    };
    onUpdate('refereeConfig', {
      ...refereeConfig,
      mode: 'organizer',
      refereeNames: updatedNames,
    } as RefereeConfig);
  };

  const handleFinalsRefereeMode = (newMode: string) => {
    onUpdate('refereeConfig', {
      ...refereeConfig,
      finalsRefereeMode: newMode as FinalsRefereeMode,
    } as RefereeConfig);
  };

  const containerStyle: CSSProperties = {
    marginTop: '32px',
  };

  const organizerSettingsStyle: CSSProperties = {
    marginTop: '16px',
    padding: '16px',
    background: 'rgba(255,215,0,0.08)',
    borderRadius: borderRadius.md,
    border: '1px solid rgba(255,215,0,0.2)',
  };

  const namesContainerStyle: CSSProperties = {
    marginTop: '12px',
    padding: '12px',
    background: 'rgba(0,0,0,0.15)',
    borderRadius: borderRadius.sm,
  };

  const hasNames = refereeConfig?.refereeNames && Object.keys(refereeConfig.refereeNames).length > 0;

  // Prüft ob ein Schiedsrichter ein Duplikat ist (= ein vorheriger SR hat denselben Namen)
  const isRefereeDuplicate = (refNumber: number, refName: string | undefined): boolean => {
    if (!refName?.trim()) return false;
    if (!refereeConfig?.refereeNames) return false;
    const normalizedName = refName.trim().toLowerCase();
    // Prüfe ob ein vorheriger Schiedsrichter (1 bis refNumber-1) denselben Namen hat
    for (let i = 1; i < refNumber; i++) {
      if (refereeConfig.refereeNames[i]?.trim().toLowerCase() === normalizedName) {
        return true;
      }
    }
    return false;
  };

  // Prüft ob ein Schiedsrichter ein Original ist (= ein späterer SR hat denselben Namen)
  const isRefereeOriginal = (refNumber: number, refName: string | undefined): boolean => {
    if (!refName?.trim()) return false;
    if (!refereeConfig?.refereeNames) return false;
    const normalizedName = refName.trim().toLowerCase();
    const totalRefs = refereeConfig.numberOfReferees || 2;
    // Prüfe ob ein späterer Schiedsrichter (refNumber+1 bis totalRefs) denselben Namen hat
    for (let i = refNumber + 1; i <= totalRefs; i++) {
      if (refereeConfig.refereeNames[i]?.trim().toLowerCase() === normalizedName) {
        return true;
      }
    }
    return false;
  };

  return (
    <div style={containerStyle}>
      <h3 style={{
        fontSize: '16px',
        fontWeight: fontWeights.semibold,
        color: colors.textPrimary,
        marginBottom: '16px'
      }}>
        Schiedsrichter
      </h3>

      <Select
        label="Schiedsrichter-Modus"
        value={mode}
        onChange={handleModeChange}
        options={[
          { value: 'none', label: 'Keine Schiedsrichter' },
          { value: 'organizer', label: 'Veranstalter stellt SR (eigene Schiedsrichter)' },
          { value: 'teams', label: 'Teams stellen SR (nach eigenem Spiel)' },
        ]}
      />
      <p style={{ fontSize: '11px', color: colors.textSecondary, lineHeight: '1.4', marginTop: '8px' }}>
        <strong>Veranstalter-Modus:</strong> Sie bringen eigene Schiedsrichter mit (z.B. SR1, SR2).{' '}
        <strong>Teams-Modus:</strong> Jedes Team pfeift nach seinem Spiel das nächste Spiel auf dem gleichen Feld.
      </p>

      {/* Organizer Mode Settings */}
      {mode === 'organizer' && (
        <div style={organizerSettingsStyle}>
          <div className="referee-grid" style={{ display: 'grid', gap: '16px', marginBottom: '16px' }}>
            <NumberStepper
              label="Anzahl Schiedsrichter"
              value={refereeConfig?.numberOfReferees || 2}
              onChange={(v) => handleNumberChange('numberOfReferees', v)}
              min={1}
              max={20}
              mode="stepper"
            />
            <NumberStepper
              label="Max. zusammenhängende Partien"
              value={refereeConfig?.maxConsecutiveMatches || 1}
              onChange={(v) => handleNumberChange('maxConsecutiveMatches', v)}
              min={1}
              max={5}
              mode="stepper"
            />
          </div>
          <p style={{ fontSize: '11px', color: colors.textSecondary, lineHeight: '1.4', margin: '0 0 16px 0' }}>
            Die Schiedsrichter werden automatisch fair auf alle Spiele verteilt.
            "Max. zusammenhängende Partien = 1" bedeutet keine direkt aufeinanderfolgenden Einsätze.
          </p>

          {/* Names Checkbox */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginBottom: '12px' }}>
            <input
              type="checkbox"
              checked={hasNames}
              onChange={(e) => handleNamesToggle(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: colors.accent }}
            />
            <span style={{ color: colors.textPrimary, fontSize: '14px', fontWeight: fontWeights.medium }}>
              Namen der Schiedsrichter angeben
            </span>
          </label>

          {/* Name Inputs */}
          {hasNames && (
            <div style={namesContainerStyle}>
              <h4 style={{ color: colors.textPrimary, fontSize: '13px', margin: '0 0 12px 0', fontWeight: fontWeights.semibold }}>
                Schiedsrichter-Namen
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {Array.from({ length: refereeConfig.numberOfReferees || 2 }, (_, i) => i + 1).map((refNumber) => {
                  const refName = refereeConfig.refereeNames?.[refNumber] || '';
                  const isDuplicate = isRefereeDuplicate(refNumber, refName);
                  const isOriginal = isRefereeOriginal(refNumber, refName);
                  const hasError = isDuplicate || isOriginal;
                  return (
                    <div key={refNumber}>
                      <Input
                        label={`SR ${refNumber}`}
                        type="text"
                        value={refName}
                        onChange={(v) => handleNameChange(refNumber, v)}
                        placeholder={`Name von Schiedsrichter ${refNumber}`}
                        error={hasError}
                      />
                      {hasError && (
                        <p style={{
                          margin: `${spacing.xs} 0 0 0`,
                          color: colors.error,
                          fontSize: '11px',
                        }}>
                          Dieser Name wird bereits verwendet
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              <p style={{ fontSize: '11px', color: colors.textSecondary, lineHeight: '1.4', marginTop: '12px', marginBottom: 0 }}>
                Die Namen erscheinen später im Spielplan statt "SR1", "SR2", etc.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Finals Referee Mode (Teams Mode only) */}
      {showFinalsOptions && (
        <div style={{ marginTop: '16px' }}>
          <Select
            label="Schiedsrichter in Finalphase"
            value={refereeConfig?.finalsRefereeMode || 'none'}
            onChange={handleFinalsRefereeMode}
            options={[
              { value: 'none', label: 'Keine SR in Finalphase' },
              { value: 'neutralTeams', label: 'Ausgeschiedene Teams (nicht in Finalrunde)' },
              { value: 'nonParticipatingTeams', label: 'Unbeteiligte Teams (nicht im aktuellen Spiel)' },
            ]}
          />
          <p style={{ fontSize: '11px', color: colors.textSecondary, lineHeight: '1.4', marginTop: '8px' }}>
            <strong>Ausgeschiedene Teams:</strong> Nur Teams, die nicht in der Finalrunde spielen.{' '}
            <strong>Unbeteiligte Teams:</strong> Teams die aktuell nicht im Finalspiel stehen (flexibler).
          </p>
        </div>
      )}

      {/* Responsive Styles */}
      <style>{`
        .referee-grid {
          grid-template-columns: 1fr 1fr;
        }

        @media (max-width: 540px) {
          .referee-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};
