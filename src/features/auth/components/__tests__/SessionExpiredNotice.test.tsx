/**
 * C-SITZUNG-STILL (@AN-021, Ü1.2): globaler Hinweis „Anmeldung abgelaufen“ – auf jeder Route außer
 * /login, schließbar, ohne Doppelung auf der Anmeldeseite.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { safeSessionStorage } from '../../../../core/utils/safeStorage';
import { SessionExpiredNotice } from '../SessionExpiredNotice';

function renderAt(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <SessionExpiredNotice />
    </MemoryRouter>,
  );
}

describe('SessionExpiredNotice (@AN-021)', () => {
  beforeEach(() => {
    safeSessionStorage.removeItem('auth:sessionExpired');
  });

  afterEach(() => {
    cleanup();
  });

  it('@AN-021 Pflicht: Merker gesetzt → Hinweis mit role=status und Schließen-Knopf', () => {
    safeSessionStorage.setItem('auth:sessionExpired', '1');
    renderAt('/');
    expect(screen.getByTestId('session-expired').getAttribute('role')).toBe('status');
    expect(screen.getByTestId('session-expired').textContent).toContain('auth:errors.sessionExpired');
    expect(screen.getByTestId('session-expired-dismiss')).toBeTruthy();
  });

  it('Schließen löscht den Merker und blendet den Hinweis aus', () => {
    safeSessionStorage.setItem('auth:sessionExpired', '1');
    renderAt('/');
    fireEvent.click(screen.getByTestId('session-expired-dismiss'));
    expect(screen.queryByTestId('session-expired')).toBeNull();
    expect(safeSessionStorage.getItem('auth:sessionExpired')).toBeNull();
  });

  it('Gegenbeispiel: auf /login kein globaler Hinweis (die Anmeldeseite zeigt ihn selbst)', () => {
    safeSessionStorage.setItem('auth:sessionExpired', '1');
    renderAt('/login');
    expect(screen.queryByTestId('session-expired')).toBeNull();
  });

  it('Gegenbeispiel: ohne Merker kein Hinweis', () => {
    renderAt('/');
    expect(screen.queryByTestId('session-expired')).toBeNull();
  });
});
