/**
 * @OB-087 Zeile 3 im echten Streifen unter der Tafel: der Tipp auf „Anmelden“ führt zur Anmeldung (Route `/login`).
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { emptyOutboxStatus } from '../../../../core/match/client/outboxTypes';

vi.mock('../../../../features/collaboration', () => ({ AwaitingServerCopyLine: () => null }));
vi.mock('../../../../features/hallenton/ui/CockpitHallHinweis', () => ({ CockpitHallHinweis: () => null }));

import { CockpitKopfStreifen } from '../CockpitKopfStreifen';

function zeige(authRequired: boolean) {
  return render(
    <MemoryRouter initialEntries={['/tournament/t1/live']}>
      <Routes>
        <Route path="/login" element={<div data-testid="anmeldung" />} />
        <Route
          path="*"
          element={(
            <CockpitKopfStreifen
              tournamentId="t1" matchId="m1" feldId="field-1" zustand="laeuft" readOnly={false} fremdGesteuert={false}
              outboxStatus={{ ...emptyOutboxStatus(), authRequired }} onOutboxReload={vi.fn()} nurZusehen={null}
            />
          )}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('@OB-087 Zeile 3 – Cockpit: „Anmelden“ am Hinweis „Bitte neu anmelden“', () => {
  it('@OB-087 Zeile 3: der Tipp auf „Anmelden“ öffnet die Anmeldung', () => {
    zeige(true);
    fireEvent.click(screen.getByTestId('outbox-notice-login'));
    expect(screen.getByTestId('anmeldung')).toBeInTheDocument();
  });

  it('@OB-087 Zeile 3 Gegenbeispiel: ist die Sitzung gültig, steht weder Hinweis noch Taste da', () => {
    zeige(false);
    expect(screen.queryByTestId('outbox-notice-login')).toBeNull();
    expect(screen.queryByTestId('outbox-notice')).toBeNull();
  });
});
