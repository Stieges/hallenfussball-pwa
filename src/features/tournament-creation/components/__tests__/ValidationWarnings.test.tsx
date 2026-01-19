import { describe, it, expect } from 'vitest';
import { Tournament } from '../../../../types/tournament';

// Extract validation logic for testing
function validateConfiguration(formData: Partial<Tournament>) {
  const issues: Array<{ type: 'error' | 'warning' | 'info'; message: string; suggestion?: string }> = [];

  const teams = formData.numberOfTeams || 4;
  const fields = formData.numberOfFields || 1;
  const groups = formData.numberOfGroups || 2;
  const groupSystem = formData.groupSystem ?? 'roundRobin';
  const gameDuration = formData.groupPhaseGameDuration ?? 10;
  const breakDuration = formData.groupPhaseBreakDuration ?? 2;

  // Calculate match count
  let totalMatches: number;
  if (groupSystem === 'roundRobin') {
    totalMatches = (teams * (teams - 1)) / 2;
  } else {
    const teamsPerGroup = Math.ceil(teams / groups);
    totalMatches = ((teamsPerGroup * (teamsPerGroup - 1)) / 2) * groups;
  }

  // Calculate duration
  const slotDuration = gameDuration + breakDuration;
  const slotsNeeded = Math.ceil(totalMatches / fields);
  const totalMinutes = slotsNeeded * slotDuration;
  const hours = totalMinutes / 60;

  // Too many teams for one field
  if (teams > 8 && fields === 1) {
    issues.push({
      type: 'warning',
      message: `${teams} Teams auf nur 1 Feld führt zu sehr langer Turnierdauer`,
      suggestion: `Empfohlen: mindestens ${Math.ceil(teams / 8)} Felder`,
    });
  }

  // Unrealistic duration
  if (hours > 10) {
    issues.push({
      type: 'error',
      message: `Geschätzte Dauer von ${Math.round(hours)}h ist unrealistisch für einen Tag`,
      suggestion: 'Erhöhe die Feldanzahl oder reduziere die Teamanzahl',
    });
  } else if (hours > 6 && hours <= 10) {
    issues.push({
      type: 'warning',
      message: `Lange Turnierdauer von ca. ${Math.round(hours)}h`,
      suggestion: 'Plane ausreichend Pausen ein',
    });
  }

  // Groups don't divide evenly
  if (groupSystem === 'groupsAndFinals' && teams % groups !== 0) {
    const teamsPerGroup = Math.ceil(teams / groups);
    const lastGroupSize = teams - (teamsPerGroup * (groups - 1));
    issues.push({
      type: 'info',
      message: `Ungleiche Gruppengrößen: ${groups - 1}x ${teamsPerGroup} Teams, 1x ${lastGroupSize} Teams`,
    });
  }

  // Too few teams for groups
  if (groupSystem === 'groupsAndFinals' && teams < groups * 2) {
    issues.push({
      type: 'error',
      message: `Zu wenig Teams für ${groups} Gruppen (min. ${groups * 2} benötigt)`,
      suggestion: 'Reduziere die Gruppenanzahl oder erhöhe die Teamanzahl',
    });
  }

  // DFB mismatch
  if (formData.useDFBKeys && formData.dfbKeyPattern) {
    const patternTeams = parseInt(formData.dfbKeyPattern.match(/(\d+)M/)?.[1] || '0');
    if (patternTeams > 0 && patternTeams !== teams) {
      issues.push({
        type: 'warning',
        message: `DFB-Muster ist für ${patternTeams} Teams, aber ${teams} Teams ausgewählt`,
        suggestion: 'Die Teamanzahl wird automatisch angepasst',
      });
    }
  }

  // Very short game duration
  if (gameDuration < 5) {
    issues.push({
      type: 'info',
      message: `Sehr kurze Spieldauer von ${gameDuration} Minuten`,
    });
  }

  // No break
  if (breakDuration === 0 && totalMatches > 10) {
    issues.push({
      type: 'info',
      message: 'Keine Pause zwischen Spielen - Teams haben keine Erholungszeit',
    });
  }

  // Zero point system
  const points = formData.pointSystem;
  if (points?.win === 0 && points.draw === 0 && points.loss === 0) {
    issues.push({
      type: 'warning',
      message: 'Punktesystem hat überall 0 Punkte - Tabelle wird nicht aussagekräftig',
    });
  }

  return issues;
}

describe('ValidationWarnings', () => {
  describe('validateConfiguration', () => {
    it('returns no issues for valid configuration', () => {
      const formData: Partial<Tournament> = {
        numberOfTeams: 6,
        numberOfFields: 1,
        groupSystem: 'roundRobin',
        groupPhaseGameDuration: 10,
        groupPhaseBreakDuration: 2,
      };

      const issues = validateConfiguration(formData);
      expect(issues).toHaveLength(0);
    });

    it('warns when too many teams for one field', () => {
      const formData: Partial<Tournament> = {
        numberOfTeams: 12,
        numberOfFields: 1,
        groupSystem: 'roundRobin',
      };

      const issues = validateConfiguration(formData);
      expect(issues.some(i => i.type === 'warning' && i.message.includes('12 Teams'))).toBe(true);
    });

    it('returns error for unrealistic duration (> 10 hours)', () => {
      const formData: Partial<Tournament> = {
        numberOfTeams: 20,
        numberOfFields: 1,
        groupSystem: 'roundRobin',
        groupPhaseGameDuration: 15,
        groupPhaseBreakDuration: 5,
      };

      const issues = validateConfiguration(formData);
      expect(issues.some(i => i.type === 'error' && i.message.includes('unrealistisch'))).toBe(true);
    });

    it('warns for long duration (6-10 hours)', () => {
      const formData: Partial<Tournament> = {
        numberOfTeams: 12,
        numberOfFields: 2,
        groupSystem: 'roundRobin',
        groupPhaseGameDuration: 12,
        groupPhaseBreakDuration: 3,
      };

      const issues = validateConfiguration(formData);
      expect(issues.some(i => i.type === 'warning' && i.message.includes('Lange Turnierdauer'))).toBe(true);
    });

    it('informs about uneven group sizes', () => {
      const formData: Partial<Tournament> = {
        numberOfTeams: 7,
        numberOfGroups: 2,
        groupSystem: 'groupsAndFinals',
      };

      const issues = validateConfiguration(formData);
      expect(issues.some(i => i.type === 'info' && i.message.includes('Ungleiche Gruppengrößen'))).toBe(true);
    });

    it('returns error when too few teams for groups', () => {
      const formData: Partial<Tournament> = {
        numberOfTeams: 3,
        numberOfGroups: 2,
        groupSystem: 'groupsAndFinals',
      };

      const issues = validateConfiguration(formData);
      expect(issues.some(i => i.type === 'error' && i.message.includes('Zu wenig Teams'))).toBe(true);
    });

    it('warns about DFB pattern mismatch', () => {
      const formData: Partial<Tournament> = {
        numberOfTeams: 8,
        useDFBKeys: true,
        dfbKeyPattern: '1T06M',
        groupSystem: 'roundRobin',
      };

      const issues = validateConfiguration(formData);
      expect(issues.some(i => i.type === 'warning' && i.message.includes('DFB-Muster'))).toBe(true);
    });

    it('informs about very short game duration', () => {
      const formData: Partial<Tournament> = {
        numberOfTeams: 4,
        groupPhaseGameDuration: 3,
      };

      const issues = validateConfiguration(formData);
      expect(issues.some(i => i.type === 'info' && i.message.includes('kurze Spieldauer'))).toBe(true);
    });

    it('informs about no break between matches', () => {
      const formData: Partial<Tournament> = {
        numberOfTeams: 8,
        groupPhaseBreakDuration: 0,
        groupSystem: 'roundRobin',
      };

      const issues = validateConfiguration(formData);
      expect(issues.some(i => i.type === 'info' && i.message.includes('Keine Pause'))).toBe(true);
    });

    it('warns about zero point system', () => {
      const formData: Partial<Tournament> = {
        numberOfTeams: 4,
        pointSystem: { win: 0, draw: 0, loss: 0 },
      };

      const issues = validateConfiguration(formData);
      expect(issues.some(i => i.type === 'warning' && i.message.includes('0 Punkte'))).toBe(true);
    });
  });
});
