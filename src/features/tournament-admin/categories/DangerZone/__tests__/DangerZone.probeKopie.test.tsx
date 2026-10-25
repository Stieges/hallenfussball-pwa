/**
 * @W5-027 – Nach der Generalprobe wird die Kopie archiviert, das Original bleibt.
 * R3-1: die alten Knöpfe „Turnier beenden“/„Turnier archivieren“ (setzten nur einen Haken) sind weg (C-FINISH-PROMISE); der Weg
 * über den Abschluss-Dialog kommt mit R3-4 – bis dahin ist der Archiv-Weg der Probe-Kopie rot (`it.fails`).
 * Gherkin: docs/anforderungen/2026-09-27_wizard-nach-dem-anlegen.md. Die Löschsperre (@LZ-003, @LZ-090) bleibt ohne Ausnahme.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Tournament } from '../../../../../types/tournament';
import { buildCopiedTournament } from '../../../../../core/models/tournamentCopy';
import { hallencupOstGespielt } from '../../../../../core/models/__fixtures__/hallencupOstGespielt';
import { categorizeTournament, getExtendedCategories } from '../../../../../utils/tournamentCategories';

vi.mock('../../../../auth/hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
vi.mock('../../../../auth/hooks/useTournamentMembers', () => ({
  useTournamentMembers: () => ({
    myMembership: { id: 'm1', userId: 'olli', tournamentId: 'x', role: 'owner', teamIds: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    isLoading: false,
  }),
}));

import { DangerZoneCategory } from '../index';

/** „Hallencup Ost (Probe)“ mit gespielter Generalprobe: ein Spiel beendet, der Rest noch offen. */
function gespielteKopie(): Tournament {
  const kopie = buildCopiedTournament(hallencupOstGespielt(), {
    newId: crypto.randomUUID(), title: 'Hallencup Ost (Probe)', now: '2026-11-20T10:00:00.000Z', makeId: () => crypto.randomUUID(),
  });
  kopie.matches = kopie.matches.map((spiel, i) =>
    i === 0 ? { ...spiel, scoreA: 2, scoreB: 1, matchStatus: 'finished' as const, finishedAt: '2026-11-20T10:15:00.000Z' } : spiel);
  return kopie;
}

function renderDangerZone(tournament: Tournament, onTournamentUpdate = vi.fn()) {
  render(<DangerZoneCategory tournamentId={tournament.id} tournament={tournament} onTournamentUpdate={onTournamentUpdate} onLocalTournamentUpdate={vi.fn()} />);
  return onTournamentUpdate;
}

describe('@W5-027 Kopie nach der Generalprobe archivieren', () => {
  it('@W5-027 die gespielte Kopie steht auf der Startseite bei „Läuft“; ist sie am Server abgeschlossen, im Archiv und nicht mehr dort', () => {
    const kopie = gespielteKopie();
    // KB-3c: ein Spiel ist beendet, also angepfiffen: „Läuft“ (@LZ-001), nicht mehr „kommend“.
    expect(categorizeTournament({ ...kopie, lifecycleStatus: 'fixed' })).toBe('running');

    const archiviert: Tournament = { ...kopie, lifecycleStatus: 'finished', finishedAt: '2026-11-20T11:00:00.000Z' };
    const kategorien = getExtendedCategories([archiviert]);
    expect(kategorien.finished.map((t) => t.id)).toEqual([kopie.id]);
    expect(kategorien.upcoming).toEqual([]);
    expect(kategorien.running).toEqual([]);
    expect(kategorien.trashed).toEqual([]);
    // gelöscht ist sie nicht: kein Papierkorb-Vermerk
    expect(archiviert.deletedAt).toBeUndefined();
  });

  it.fails('@W5-027 Olli kann die gespielte Kopie im Gefahrenbereich archivieren (Weg kommt mit R3-4, Abschluss-Dialog)', () => {
    renderDangerZone(gespielteKopie());
    expect(screen.getByRole('button', { name: /Turnier archivieren|Turnier abschließen/i })).toBeInTheDocument();
  });

  it('C-FINISH-PROMISE Gegenbeispiel: die alten Knöpfe „Turnier beenden“ und „Turnier archivieren“ gibt es nicht mehr, auch nicht für die Turnierleitung', () => {
    renderDangerZone(gespielteKopie());
    expect(screen.queryByRole('button', { name: /Turnier beenden/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Turnier archivieren/i })).not.toBeInTheDocument();
  });

  // Gegenbeispiel: die Löschsperre @LZ-003/@LZ-090 gilt auch für die Probe-Kopie, sobald ein Spiel angepfiffen wurde
  it('@W5-027 Gegenbeispiel: die gespielte Kopie lässt sich weiterhin nicht löschen', () => {
    renderDangerZone(gespielteKopie());
    expect(screen.queryByRole('button', { name: /Turnier löschen/i })).not.toBeInTheDocument();
  });
});
