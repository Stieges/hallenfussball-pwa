/**
 * B-03 (V3) — @OB-043-Gruppe aus B03.platzhalterListe.test.tsx.
 * Gemeinsame Mocks und Helfer: ./helpers/b03PlatzhalterHarness.tsx.
 * Jeder Test unverändert; 30 s Timeout je Fall (kein globales testTimeout).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeTournament, renderInRouter, oeffneAlleAbschnitte, expectAbsent, expectRendered } from './helpers/b03PlatzhalterHarness';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('@OB-043 Die Pausendauer steht schreibgeschützt da wie die Spielzeit pro Spiel', () => {
  it('@OB-043 Pausendauer im Bereich Spielzeiten nicht änderbar, mit demselben Hinweis wie die Spielzeit', async () => {
    const { SettingsCategory } = await import('../features/tournament-admin/categories/Settings');
    const { container } = renderInRouter(
      <SettingsCategory
        tournamentId="t1"
        tournament={makeTournament()}
        onTournamentUpdate={vi.fn()}
      />
    );
    expectRendered(container);
    oeffneAlleAbschnitte(container);
    const labels = Array.from(container.querySelectorAll('label'));
    const pauseLabel = labels.find((label) => (label.textContent ?? '').includes('settingsSection.breakTime'));
    expect(pauseLabel).toBeDefined();
    const pauseGroup = pauseLabel?.parentElement;
    expect(pauseGroup).toBeTruthy();
    const input = pauseGroup?.querySelector('input');
    expect(input).toBeTruthy();
    expect(input?.disabled ?? false).toBe(true);
    expect(container.textContent ?? '').toMatch(/settingsSection\.gameTimeLockedHint/);
    expectAbsent(/comingSoon|folgt später|später/);
  }, 30_000);
});
