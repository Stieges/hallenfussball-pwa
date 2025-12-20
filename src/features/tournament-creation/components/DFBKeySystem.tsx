import { Select } from '../../../components/ui';
import { Tournament } from '../../../types/tournament';
import { DFB_ROUND_ROBIN_PATTERNS, getDFBPattern, DFBMatchPattern } from '../../../constants/dfbMatchPatterns';
import styles from './DFBKeySystem.module.css';

interface DFBKeySystemProps {
  formData: Partial<Tournament>;
  onUpdate: <K extends keyof Tournament>(field: K, value: Tournament[K]) => void;
}

/**
 * Info panel showing details about the selected DFB pattern
 */
const PatternInfoPanel: React.FC<{ pattern: DFBMatchPattern }> = ({ pattern }) => {
  const totalMatches = pattern.rounds.reduce((sum, round) => {
    // Filter out BYE matches
    const realMatches = round.filter(match => !match.includes('BYE'));
    return sum + realMatches.length;
  }, 0);

  const hasBye = pattern.rounds.some(round =>
    round.some(match => match.includes('BYE'))
  );

  const matchesPerRound = pattern.rounds[0]?.filter(m => !m.includes('BYE')).length || 0;

  return (
    <div className={styles.infoPanel} role="region" aria-label="Musterdetails">
      <div className={styles.statsGrid}>
        <div className={styles.statItem}>
          <div className={styles.statValue}>{pattern.teams}</div>
          <div className={styles.statLabel}>Teams</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statValue}>{totalMatches}</div>
          <div className={styles.statLabel}>Spiele</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statValue}>{pattern.rounds.length}</div>
          <div className={styles.statLabel}>Runden</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statValue}>{matchesPerRound}</div>
          <div className={styles.statLabel}>Pro Runde</div>
        </div>
      </div>

      {hasBye && (
        <div className={styles.byeWarning} role="note">
          <span aria-hidden="true">⚠️</span>
          <span>Ungerade Teamanzahl - enthält Freilose</span>
        </div>
      )}

      <div className={styles.patternCode}>
        <strong>Schlüssel:</strong> {pattern.code} = {pattern.days || 1} Tag, {pattern.teams} Mannschaften
        {pattern.subgroups ? `, ${pattern.subgroups} Untergruppen` : ''}
      </div>
    </div>
  );
};

export const DFBKeySystem: React.FC<DFBKeySystemProps> = ({
  formData,
  onUpdate,
}) => {
  const useDFBKeys = formData.useDFBKeys ?? false;
  const selectedPattern = formData.dfbKeyPattern || '1T06M';
  const currentPattern = DFB_ROUND_ROBIN_PATTERNS.find(p => p.code === selectedPattern);

  const handleToggle = (enabled: boolean) => {
    onUpdate('useDFBKeys', enabled);

    if (enabled) {
      const teamCount = formData.numberOfTeams || 4;
      const pattern = getDFBPattern(teamCount);
      if (pattern) {
        onUpdate('dfbKeyPattern', pattern.code);
      }
    }
  };

  const handlePatternChange = (patternCode: string) => {
    onUpdate('dfbKeyPattern', patternCode);

    // Sync team count with selected pattern
    const pattern = DFB_ROUND_ROBIN_PATTERNS.find(p => p.code === patternCode);
    if (pattern && pattern.teams !== formData.numberOfTeams) {
      onUpdate('numberOfTeams', pattern.teams);
    }
  };

  // Only show for roundRobin system
  if (formData.groupSystem !== 'roundRobin') {
    return null;
  }

  return (
    <div className={styles.container}>
      <label className={styles.checkboxLabel}>
        <input
          type="checkbox"
          checked={useDFBKeys}
          onChange={(e) => handleToggle(e.target.checked)}
          className={styles.checkbox}
          aria-describedby="dfb-description"
        />
        <span className={styles.labelText}>
          DFB-Schlüsselsystem verwenden
        </span>
      </label>
      <p id="dfb-description" className={styles.description}>
        Verwendet die offiziellen DFB-Ansetzungsmuster für Round-Robin Turniere
      </p>

      {useDFBKeys && (
        <div className={styles.patternSelector}>
          <Select
            label="Ansetzungsmuster"
            value={selectedPattern}
            onChange={handlePatternChange}
            options={DFB_ROUND_ROBIN_PATTERNS.map(pattern => ({
              value: pattern.code,
              label: `${pattern.code} (${pattern.teams} Teams)`
            }))}
          />

          {/* Pattern Info Panel */}
          {currentPattern && (
            <PatternInfoPanel pattern={currentPattern} />
          )}
        </div>
      )}
    </div>
  );
};
