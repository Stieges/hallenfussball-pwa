/**
 * Sport Configuration Tests
 */
/* eslint-disable @typescript-eslint/no-deprecated -- Tests for deprecated BC functions */

import { describe, it, expect } from 'vitest';
import {
  getSportConfig,
  getAvailableSports,
  getSportsByCategory,
  isValidSportId,
  getSportTerminology,
  getSportDefaults,
  getSportRules,
  getSportFeatures,
  getSportAgeClasses,
  getSportValidation,
  legacySportToSportId,
  sportIdToLegacySport,
  footballIndoorConfig,
  footballOutdoorConfig,
  DEFAULT_SPORT_ID,
} from '../index';

describe('Sport Configuration', () => {
  describe('footballIndoorConfig', () => {
    it('should have correct id and name', () => {
      expect(footballIndoorConfig.id).toBe('football-indoor');
      expect(footballIndoorConfig.name).toBe('Hallenfußball');
      expect(footballIndoorConfig.icon).toBe('⚽');
    });

    it('should have correct terminology', () => {
      const { terminology } = footballIndoorConfig;
      expect(terminology.field).toBe('Feld');
      expect(terminology.fieldPlural).toBe('Felder');
      expect(terminology.goal).toBe('Tor');
      expect(terminology.goalPlural).toBe('Tore');
      expect(terminology.goalAnimationText).toBe('TOR!');
      expect(terminology.scoreFormat).toBe('goals');
    });

    it('should have correct defaults', () => {
      const { defaults } = footballIndoorConfig;
      expect(defaults.gameDuration).toBe(10);
      expect(defaults.breakDuration).toBe(2);
      expect(defaults.pointSystem.win).toBe(3);
      expect(defaults.pointSystem.draw).toBe(1);
      expect(defaults.pointSystem.loss).toBe(0);
      expect(defaults.allowDraw).toBe(true);
    });

    it('should have correct rules', () => {
      const { rules } = footballIndoorConfig;
      expect(rules.canDrawInGroupPhase).toBe(true);
      expect(rules.canDrawInFinals).toBe(false);
      expect(rules.hasOvertime).toBe(false);
      expect(rules.hasShootout).toBe(true);
      expect(rules.isSetBased).toBe(false);
    });

    it('should have correct features', () => {
      const { features } = footballIndoorConfig;
      expect(features.hasDFBKeys).toBe(true);
      expect(features.hasBambiniMode).toBe(true);
      expect(features.hasGoalAnimation).toBe(true);
      expect(features.isSetBased).toBe(false);
    });

    it('should have age classes', () => {
      expect(footballIndoorConfig.ageClasses.length).toBeGreaterThan(0);
      expect(footballIndoorConfig.ageClasses.find(ac => ac.value === 'U11')).toBeDefined();
      expect(footballIndoorConfig.ageClasses.find(ac => ac.value === 'E-Jugend')).toBeDefined();
    });

    it('should have validation constraints', () => {
      const { validation } = footballIndoorConfig;
      expect(validation.minTeams).toBe(3);
      expect(validation.maxTeams).toBe(64);
      expect(validation.minFields).toBe(1);
      expect(validation.maxFields).toBe(10);
    });
  });

  describe('footballOutdoorConfig', () => {
    it('should have correct id and longer game duration', () => {
      expect(footballOutdoorConfig.id).toBe('football-outdoor');
      expect(footballOutdoorConfig.defaults.gameDuration).toBe(25);
      expect(footballOutdoorConfig.defaults.periods).toBe(2);
    });

    it('should have overtime enabled', () => {
      expect(footballOutdoorConfig.rules.hasOvertime).toBe(true);
      expect(footballOutdoorConfig.rules.overtimeDuration).toBe(10);
    });

    it('should use "Platz" instead of "Feld"', () => {
      expect(footballOutdoorConfig.terminology.field).toBe('Platz');
      expect(footballOutdoorConfig.terminology.fieldPlural).toBe('Plätze');
    });
  });

  describe('getSportConfig', () => {
    it('should return correct config for valid sportId', () => {
      expect(getSportConfig('football-indoor')).toBe(footballIndoorConfig);
      expect(getSportConfig('football-outdoor')).toBe(footballOutdoorConfig);
    });

    it('should return default config for undefined', () => {
      expect(getSportConfig(undefined)).toBe(footballIndoorConfig);
    });

    it('should return default config for invalid sportId', () => {
      // @ts-expect-error Testing invalid input
      expect(getSportConfig('invalid-sport')).toBe(footballIndoorConfig);
    });
  });

  describe('getAvailableSports', () => {
    it('should return array of available sports', () => {
      const sports = getAvailableSports();
      expect(Array.isArray(sports)).toBe(true);
      expect(sports.length).toBeGreaterThanOrEqual(2);
      expect(sports.find(s => s.id === 'football-indoor')).toBeDefined();
      expect(sports.find(s => s.id === 'football-outdoor')).toBeDefined();
    });
  });

  describe('getSportsByCategory', () => {
    it('should group sports by category', () => {
      const grouped = getSportsByCategory();
      expect(grouped.ball).toBeDefined();
      expect(grouped.ball.length).toBeGreaterThanOrEqual(2);
      expect(grouped.ball.find(s => s.id === 'football-indoor')).toBeDefined();
    });
  });

  describe('isValidSportId', () => {
    it('should return true for valid sport IDs', () => {
      expect(isValidSportId('football-indoor')).toBe(true);
      expect(isValidSportId('football-outdoor')).toBe(true);
    });

    it('should return false for invalid sport IDs', () => {
      expect(isValidSportId('invalid')).toBe(false);
      expect(isValidSportId('')).toBe(false);
    });
  });

  describe('Helper functions', () => {
    it('getSportTerminology should return terminology', () => {
      const terminology = getSportTerminology('football-indoor');
      expect(terminology.goal).toBe('Tor');
    });

    it('getSportDefaults should return defaults', () => {
      const defaults = getSportDefaults('football-indoor');
      expect(defaults.gameDuration).toBe(10);
    });

    it('getSportRules should return rules', () => {
      const rules = getSportRules('football-indoor');
      expect(rules.hasShootout).toBe(true);
    });

    it('getSportFeatures should return features', () => {
      const features = getSportFeatures('football-indoor');
      expect(features.hasGoalAnimation).toBe(true);
    });

    it('getSportAgeClasses should return age classes', () => {
      const ageClasses = getSportAgeClasses('football-indoor');
      expect(ageClasses.length).toBeGreaterThan(0);
    });

    it('getSportValidation should return validation', () => {
      const validation = getSportValidation('football-indoor');
      expect(validation.minTeams).toBe(3);
    });
  });

  describe('Legacy compatibility', () => {
    it('legacySportToSportId should convert legacy sport types', () => {
      expect(legacySportToSportId('football')).toBe('football-indoor');
      expect(legacySportToSportId('other')).toBe('custom');
      expect(legacySportToSportId(undefined)).toBe(DEFAULT_SPORT_ID);
    });

    it('sportIdToLegacySport should convert back to legacy types', () => {
      expect(sportIdToLegacySport('football-indoor')).toBe('football');
      expect(sportIdToLegacySport('football-outdoor')).toBe('football');
      expect(sportIdToLegacySport('handball')).toBe('other');
      expect(sportIdToLegacySport('basketball')).toBe('other');
    });
  });

  describe('DEFAULT_SPORT_ID', () => {
    it('should be football-indoor', () => {
      expect(DEFAULT_SPORT_ID).toBe('football-indoor');
    });
  });
});
