/**
 * useUserProfile Hook
 *
 * Verwaltet Benutzer-Profil und Einstellungen in localStorage.
 */

import { useState, useEffect, useCallback } from 'react';
import { UserProfile, AppSettings, getDefaultUserProfile } from '../types/userProfile';

const STORAGE_KEY = 'userProfile';

/**
 * Hook für vollständiges User Profile Management
 */
export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        // Type assertion: stored data matches Partial<UserProfile> structure
        const parsed = JSON.parse(stored) as Partial<UserProfile>;
        // Merge mit Defaults für neue Felder
        return { ...getDefaultUserProfile(), ...parsed };
      }
    } catch (e) {
      console.error('Error loading user profile:', e);
    }
    return getDefaultUserProfile();
  });

  // Speichern bei Änderungen
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch (e) {
      console.error('Error saving user profile:', e);
    }
  }, [profile]);

  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    setProfile(prev => ({
      ...prev,
      ...updates,
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setProfile(prev => ({
      ...prev,
      settings: { ...prev.settings, ...updates },
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  return {
    profile,
    updateProfile,
    updateSettings,
  };
}

/**
 * Lightweight Hook nur für App-Einstellungen
 * Verwendet localStorage direkt für bessere Performance
 */
export function useAppSettings(): AppSettings {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...getDefaultUserProfile().settings, ...parsed.settings };
      }
    } catch (e) {
      console.error('Error loading app settings:', e);
    }
    return getDefaultUserProfile().settings;
  });

  // Sync bei localStorage-Änderungen
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setSettings({ ...getDefaultUserProfile().settings, ...parsed.settings });
        } catch (e) {
          console.error('Error parsing storage change:', e);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return settings;
}

/**
 * Schneller Zugriff auf einzelne Einstellung
 * Ohne React-State - direkt aus localStorage
 */
export function getAppSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.settings && key in parsed.settings) {
        return parsed.settings[key];
      }
    }
  } catch (e) {
    console.error('Error getting app setting:', e);
  }
  return getDefaultUserProfile().settings[key];
}
