/**
 * B2 (A-07d2, @AN-024): globaler Hinweis „abgemeldet durch anderes Gerät“ – auf jeder Route außer /login,
 * schließbar, ohne Doppelung auf der Anmeldeseite.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { safeSessionStorage } from '../../../../core/utils/safeStorage';
import { setSignedOutElsewhere } from '../../context/remoteSignOut';
import { SignedOutElsewhereNotice } from '../SignedOutElsewhereNotice';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function renderAt(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <SignedOutElsewhereNotice />
    </MemoryRouter>,
  );
}

describe('SignedOutElsewhereNotice (B2)', () => {
  beforeEach(() => {
    safeSessionStorage.removeItem('auth:signedOutElsewhere');
  });

  afterEach(() => {
    cleanup();
  });

  it('Pflicht: Merker gesetzt, Gerät auf dem Dashboard → Hinweis mit role=status und Schließen-Knopf', () => {
    safeSessionStorage.setItem('auth:signedOutElsewhere', '1');

    renderAt('/');

    const notice = screen.getByTestId('signed-out-elsewhere');
    expect(notice.getAttribute('role')).toBe('status');
    expect(notice.textContent).toContain('login.signedOutElsewhere');
    expect(screen.getByTestId('signed-out-elsewhere-dismiss')).toBeTruthy();
  });

  it('Gegenbeispiel: ohne Merker → nichts', () => {
    renderAt('/');

    expect(screen.queryByTestId('signed-out-elsewhere')).toBeNull();
  });

  it('Auf /login nicht doppelt: die Anmeldeseite zeigt den Hinweis selbst', () => {
    safeSessionStorage.setItem('auth:signedOutElsewhere', '1');

    renderAt('/login');

    expect(screen.queryByTestId('signed-out-elsewhere')).toBeNull();
  });

  it('Schließen blendet aus und löscht den Merker', () => {
    safeSessionStorage.setItem('auth:signedOutElsewhere', '1');
    renderAt('/');

    fireEvent.click(screen.getByTestId('signed-out-elsewhere-dismiss'));

    expect(screen.queryByTestId('signed-out-elsewhere')).toBeNull();
    expect(safeSessionStorage.getItem('auth:signedOutElsewhere')).toBeNull();
  });

  it('Erscheint auch, wenn der Hinweis erst nach dem Mount gesetzt wird (Prüfung läuft während des Verweilens)', () => {
    renderAt('/');
    expect(screen.queryByTestId('signed-out-elsewhere')).toBeNull();

    act(() => {
      setSignedOutElsewhere();
    });

    expect(screen.getByTestId('signed-out-elsewhere')).toBeTruthy();
  });
});
