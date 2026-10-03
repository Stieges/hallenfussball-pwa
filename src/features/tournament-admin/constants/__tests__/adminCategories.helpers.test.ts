/**
 * Abdeckung (Fixrunde 1 Teil b) — Navigations-Helfer aus admin.constants.ts
 * (getAllAdminCategories, getAdminCategory, getCategoriesByGroup,
 * getCategoryGroupConfig). Zusätzlich festgehalten: keine Navigationsbeschriftung
 * bietet „Spielplan neu generieren" an (siehe adminNavigation.noRegenerate).
 */
import { describe, it, expect } from 'vitest';
import {
  ADMIN_CATEGORIES,
  DANGER_ZONE_ITEMS,
  getAllAdminCategories,
  getAdminCategory,
  getCategoriesByGroup,
  getCategoryGroupConfig,
} from '../admin.constants';

describe('admin.constants — Navigations-Helfer (Abdeckung)', () => {
  it('getAllAdminCategories vereint Kategorien und Gefahrenbereich', () => {
    expect(getAllAdminCategories()).toHaveLength(ADMIN_CATEGORIES.length + DANGER_ZONE_ITEMS.length);
  });

  it('getAdminCategory findet per ID, unbekannte ID liefert undefined', () => {
    expect(getAdminCategory('danger-zone')?.label).toBe('Gefahrenbereich');
    expect(getAdminCategory('gibts-nicht')).toBeUndefined();
  });

  it('getCategoriesByGroup filtert nach Gruppe, getCategoryGroupConfig liefert die Gruppenkonfiguration', () => {
    const danger = getCategoriesByGroup('danger');
    expect(danger.map((cat) => cat.id)).toEqual([]);
    expect(getCategoryGroupConfig('danger')?.id).toBe('danger');
    expect(getCategoryGroupConfig('gibts-nicht')).toBeUndefined();
  });
});
