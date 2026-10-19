/**
 * Geräte-Rollen „Helfer“ (helper) und „Bildschirm“ (screen) in der App (A-27, brief-A-27.md R-A27-7).
 *
 * @HE-084 Ein Helfer-Zugang ohne Konto wird nicht Co-Admin: „Wenn Olli Toms Zugang zur Co-Admin machen will, in der App
 *         oder direkt beim Server – Dann bietet die App das nicht an … Und Tom bleibt Helfer im Live-Cup“.
 * @ME-069 Einen Bildschirm-Zugang gibt es nur über die Kopplung (die App vergibt die Rolle nie).
 * @HE-042 Helfer: Spielbetrieb ja, Verwaltung („ein beendetes Spiel wiedereröffnen“, „Team umbenennen“) nur Turnierleitung.
 * @ME-059 Der gekoppelte Bildschirm trägt kein Tor ein und ändert keine Einstellung.
 * Erwartete Rechte kommen aus der GELESENEN rolePermissions.json, nicht aus hasPermission().
 */
import { describe, it, expect } from 'vitest';
import rolePermissionsJson from '../../permissions/rolePermissions.json';
import {
  canChangeRole,
  canRemoveMember,
  canSetRoleTo,
  getAssignableRoles,
  hasPermission,
  isHigherRole,
  PERMISSIONS,
} from '../permissions';

const roles = (rolePermissionsJson as unknown as { roles: Record<string, string[]> }).roles;

describe('@HE-042 @ME-059 Rechte der Geräte-Rollen aus der JSON', () => {
  it('die JSON kennt helper und screen', () => {
    expect(roles.helper).toEqual(['writeMatchData']);
    expect(roles.screen).toEqual(['readDisplay']);
  });

  it.each(PERMISSIONS)('helper: hasPermission(%s) wie die JSON', (right) => {
    expect(hasPermission('helper', right)).toBe(roles.helper.includes(right));
  });

  it.each(PERMISSIONS)('screen: hasPermission(%s) wie die JSON', (right) => {
    expect(hasPermission('screen', right)).toBe(roles.screen.includes(right));
  });

  it('@HE-042 Tom (Helfer-Zugang) trägt Tore ein, öffnet kein beendetes Spiel wieder, benennt kein Team um', () => {
    expect(hasPermission('helper', 'writeMatchData')).toBe(true);
    expect(hasPermission('helper', 'leadMatches')).toBe(false);
    expect(hasPermission('helper', 'teams')).toBe(false);
  });

  it('@ME-059 der Bildschirm trägt kein Tor ein, ändert weder Monitor noch Spielplan', () => {
    expect(hasPermission('screen', 'writeMatchData')).toBe(false);
    expect(hasPermission('screen', 'manageScreens')).toBe(false);
    expect(hasPermission('screen', 'manageSchedule')).toBe(false);
    expect(hasPermission('screen', 'readDisplay')).toBe(true);
  });
});

describe('@HE-084 @ME-069 die App bietet keinen Rollenwechsel von oder zu einer Geräte-Rolle an', () => {
  it('@HE-084 Olli kann Toms Helfer-Zugang nicht zur Co-Admin machen', () => {
    expect(canChangeRole('owner', 'helper')).toBe(false);
    expect(canSetRoleTo('owner', 'helper', 'co-admin')).toBe(false);
  });

  it('@ME-069 Olli kann niemanden direkt zum Bildschirm oder Helfer-Zugang machen', () => {
    expect(canSetRoleTo('owner', 'viewer', 'screen')).toBe(false);
    expect(canSetRoleTo('owner', 'collaborator', 'helper')).toBe(false);
    expect(canChangeRole('owner', 'screen')).toBe(false);
  });

  it('@HE-084 @ME-069 die vergebbaren Rollen enthalten keine Geräte-Rolle', () => {
    expect(getAssignableRoles('owner')).not.toContain('helper');
    expect(getAssignableRoles('owner')).not.toContain('screen');
    expect(getAssignableRoles('helper')).toEqual([]);
    expect(getAssignableRoles('screen')).toEqual([]);
  });

  it('@HE-084 Gegenbeispiel: Olli macht ein Konto mit Rolle collaborator zum Trainer', () => {
    expect(canSetRoleTo('owner', 'collaborator', 'trainer')).toBe(true);
  });

  it('Entziehen bleibt möglich: Olli entfernt einen Helfer-Zugang (der Rollenwechsel ist gesperrt, nicht der Entzug)', () => {
    expect(canRemoveMember('owner', 'helper')).toBe(true);
    expect(canRemoveMember('owner', 'screen')).toBe(true);
    expect(canRemoveMember('helper', 'viewer')).toBe(false);
  });

  it('Gegenbeispiel: den Eigentümer entfernt niemand (auch nicht er selbst oder eine Co-Admin)', () => {
    expect(canRemoveMember('owner', 'owner')).toBe(false);
    expect(canRemoveMember('co-admin', 'owner')).toBe(false);
  });
});

describe('@HE-006:teil Rechte-Teil – wer über eine Beitrittsanfrage entscheiden darf (Ablauf: A-16)', () => {
  // „Wenn Olli Toms Anfrage zulässt und Maria sie kurz danach ablehnt“: Olli (Eigentümer) und Maria (Co-Admin) dürfen beide
  // entscheiden; der Wettlauf selbst („Dann gilt Ollis Entscheidung“) braucht decide_join_request (A-16).
  it('@HE-006:teil Olli und Maria dürfen Helfer-Zugänge verwalten, Toms Geräte-Zugang und der Bildschirm nicht', () => {
    expect(hasPermission('owner', 'manageHelpers')).toBe(true);
    expect(hasPermission('co-admin', 'manageHelpers')).toBe(true);
    expect(hasPermission('helper', 'manageHelpers')).toBe(false);
    expect(hasPermission('screen', 'manageHelpers')).toBe(false);
  });
});

describe('Rangfolge: screen < viewer < helper = collaborator < trainer', () => {
  it('ordnet die Geräte-Rollen ein', () => {
    expect(isHigherRole('viewer', 'screen')).toBe(true);
    expect(isHigherRole('helper', 'viewer')).toBe(true);
    expect(isHigherRole('helper', 'collaborator')).toBe(false);
    expect(isHigherRole('collaborator', 'helper')).toBe(false);
    expect(isHigherRole('trainer', 'helper')).toBe(true);
  });
});
