/**
 * Admin Center, Turnier-Einstellungen, Bereich Spielzeiten: der Hinweis unter Spielzeit und Pause sagt die
 * Wahrheit (C-ZEITEN-SPERRHINWEIS-FALSCH). Szenario: @OB-043 (Pausendauer und Spielzeit stehen schreibgeschützt
 * da, die Anzeige sagt das), Regel „Ehrlich“ aus docs/anforderungen/2026-10-02_oberflaeche.md (ein Text, der
 * anders wirkt, als er sagt, ist ein Platzhalter).
 * Heute sind beide Felder immer gesperrt; der Hinweis darf deshalb keinen Grund nennen, der nicht geprüft wird.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Tournament } from '../../../../../types/tournament';
import { hallencupOstGespielt } from '../../../../../core/models/__fixtures__/hallencupOstGespielt';
import { initRealDeI18n } from '../../../../../test/realDeI18n';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

vi.mock('../../../../auth/hooks/useCan', () => ({ useCan: () => true }));
vi.mock('../../../../../hooks/useTournamentStartState', () => ({ useTournamentStartState: () => ({ state: 'unknown' }) }));
vi.mock('../../../../../hooks', () => ({ useTournaments: () => ({ saveTournament: vi.fn() }) }));
vi.mock('../../../../../hooks/useRepository', () => ({ useRepository: () => ({ get: () => Promise.resolve(null) }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../../../../tournament-management/FieldManagement', () => ({ FieldManagement: () => null }));

import { SettingsCategory } from '../index';

/** Turnier ohne einen einzigen begonnenen Spiel-Eintrag: alle Spiele geplant. */
function ohneBegonnenesSpiel(): Tournament {
  const turnier = hallencupOstGespielt();
  return {
    ...turnier,
    matches: turnier.matches.map((m) => ({ ...m, matchStatus: 'scheduled', scoreA: undefined, scoreB: undefined })),
  };
}

function hinweisUnter(bezeichnung: string): string {
  const gruppe = screen.getByText(bezeichnung).parentElement!;
  const feld = gruppe.querySelector('input')!;
  expect(feld.disabled).toBe(true);
  return gruppe.querySelector('p')?.textContent ?? '';
}

function zeigeZeiten(turnier: Tournament): void {
  render(<SettingsCategory tournamentId={turnier.id} tournament={turnier} onTournamentUpdate={vi.fn()} />);
  fireEvent.click(screen.getByText('Spielzeiten'));
}

describe('Admin Center: Hinweis unter Spielzeit und Pause (C-ZEITEN-SPERRHINWEIS-FALSCH, @OB-043)', () => {
  it('@OB-043 ohne begonnenes Spiel behauptet der Hinweis nicht, Spiele seien gestartet', () => {
    zeigeZeiten(ohneBegonnenesSpiel());
    for (const bezeichnung of ['Spielzeit pro Spiel', 'Pausenzeit zwischen Spielen']) {
      const hinweis = hinweisUnter(bezeichnung);
      expect(hinweis).not.toMatch(/gestartet|begonnen|angepfiffen/i);
      expect(hinweis).toMatch(/nicht ändern/i);
    }
  });

  it('@OB-043 Gegenbeispiel: auch mit begonnenen Spielen bleiben beide Felder gesperrt und der Hinweis sagt dasselbe', () => {
    zeigeZeiten(hallencupOstGespielt());
    const mit = hinweisUnter('Spielzeit pro Spiel');
    expect(hinweisUnter('Pausenzeit zwischen Spielen')).toBe(mit);
    expect(mit).toMatch(/nicht ändern/i);
  });
});
