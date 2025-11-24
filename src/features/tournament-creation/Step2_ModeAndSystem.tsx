import { CSSProperties } from 'react';
import { Card, Select, Input, Icons } from '../../components/ui';
import { Tournament, GroupSystem, PlacementCriterion, PointSystem } from '../../types/tournament';
import { theme } from '../../styles/theme';

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
            options={[
              { value: 'roundRobin', label: 'Jeder gegen jeden' },
              { value: 'groupsAndFinals', label: 'Gruppenphase + Finalrunde' },
            ]}
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '16px' }}>
            {canUseGroups && (
              <Select
                label="Anzahl Gruppen"
                value={formData.numberOfGroups || 2}
                onChange={(v) => onUpdate('numberOfGroups', parseInt(v))}
                options={[
                  { value: 2, label: '2 Gruppen' },
                  { value: 3, label: '3 Gruppen' },
                  { value: 4, label: '4 Gruppen' },
                ]}
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
            <Input
              label="Spieldauer (Min.)"
              type="number"
              value={formData.gameDuration || 10}
              onChange={(v) => onUpdate('gameDuration', parseInt(v) || 10)}
            />
          </div>

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

          {/* Finals */}
          {canUseGroups && (
            <div style={{ marginTop: '24px' }}>
              <h3 style={{ color: theme.colors.accent, fontSize: '14px', margin: '0 0 16px 0' }}>
                🏆 Finalspiele
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {[
                  { key: 'final', label: 'Finale (1. vs. 1.)', icon: '🥇' },
                  { key: 'thirdPlace', label: 'Spiel um Platz 3', icon: '🥉' },
                  { key: 'fifthSixth', label: 'Platzierung 5/6', icon: '5️⃣' },
                  { key: 'seventhEighth', label: 'Platzierung 7/8', icon: '7️⃣' },
                ].map((final) => (
                  <button
                    key={final.key}
                    onClick={() => {
                      const currentFinals = formData.finals || { final: false, thirdPlace: false, fifthSixth: false, seventhEighth: false };
                      onUpdate('finals', { ...currentFinals, [final.key]: !currentFinals[final.key as keyof typeof currentFinals] });
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '14px 16px',
                      background: formData.finals?.[final.key as keyof typeof formData.finals] ? 'rgba(255,215,0,0.15)' : 'rgba(0,0,0,0.2)',
                      border: formData.finals?.[final.key as keyof typeof formData.finals] ? '1px solid rgba(255,215,0,0.4)' : '1px solid transparent',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s',
                    }}
                  >
                    <span style={{ fontSize: '20px' }}>{final.icon}</span>
                    <span style={{ color: theme.colors.text.primary, fontSize: '14px' }}>{final.label}</span>
                    {formData.finals?.[final.key as keyof typeof formData.finals] && (
                      <span style={{ marginLeft: 'auto', color: theme.colors.primary }}>
                        <Icons.Check />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Point System */}
          <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: `1px solid ${theme.colors.border}` }}>
            <h3 style={{ color: theme.colors.secondary, fontSize: '14px', margin: '0 0 16px 0' }}>
              🎯 Punktesystem
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
              <button
                onClick={() => onUpdate('pointSystem', { win: 3, draw: 1, loss: 0 })}
                style={pointPresetStyle(
                  formData.pointSystem?.win === 3 && formData.pointSystem?.draw === 1 && formData.pointSystem?.loss === 0
                )}
              >
                <div style={{ fontSize: '16px', fontWeight: '700', color: theme.colors.text.primary }}>3-1-0</div>
                <div style={{ fontSize: '11px', color: theme.colors.text.secondary, marginTop: '2px' }}>Standard</div>
              </button>
              <button
                onClick={() => onUpdate('pointSystem', { win: 2, draw: 1, loss: 0 })}
                style={pointPresetStyle(
                  formData.pointSystem?.win === 2 && formData.pointSystem?.draw === 1 && formData.pointSystem?.loss === 0
                )}
              >
                <div style={{ fontSize: '16px', fontWeight: '700', color: theme.colors.text.primary }}>2-1-0</div>
                <div style={{ fontSize: '11px', color: theme.colors.text.secondary, marginTop: '2px' }}>Klassisch</div>
              </button>
              <button
                onClick={() => onUpdate('pointSystem', { win: 3, draw: 0, loss: 0 })}
                style={pointPresetStyle(
                  formData.pointSystem?.win === 3 && formData.pointSystem?.draw === 0 && formData.pointSystem?.loss === 0
                )}
              >
                <div style={{ fontSize: '16px', fontWeight: '700', color: theme.colors.text.primary }}>3-0-0</div>
                <div style={{ fontSize: '11px', color: theme.colors.text.secondary, marginTop: '2px' }}>Nur Siege</div>
              </button>
            </div>
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
