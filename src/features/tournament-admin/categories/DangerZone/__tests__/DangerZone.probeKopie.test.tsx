/**
 * @W5-027 – Nach der Generalprobe wird die Kopie archiviert, das Original bleibt.
 * Gherkin: docs/anforderungen/2026-09-27_wizard-nach-dem-anlegen.md. Die Löschsperre (@LZ-003, @LZ-090) bleibt ohne Ausnahme.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tournament } from '../../../../../types/tournament';
import { buildCopiedTournament } from '../../../../../core/models/tournamentCopy';
import { hallencupOstGespielt, OST_ID } from '../../../../../core/models/__fixtures__/hallencupOstGespielt';
import { categorizeTournament, getExtendedCategories } from '../../../../../utils/tournamentCategories';

vi.mock('../../../../auth/hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
vi.mock('../../../../auth/hooks/useTournamentMembers', () => ({
  useTournamentMembers: () => ({
    myMembership: { id: 'm1', userId: 'olli', tournamentId: 'x', role: 'owner', teamIds: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    isLoading: false,
  }),
}));

import { DangerZoneCategory } from '../index';

const JETZT = new Date('2026-11-20T10:00:00.000Z');

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

async function archivieren() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /Turnier archivieren/i }));
  const dialog = screen.getByRole('dialog');
  await user.type(within(dialog).getByRole('textbox'), 'ARCHIVIEREN');
  await user.click(within(dialog).getByRole('button', { name: /Turnier archivieren/i }));
}

describe('@W5-027 Kopie nach der Generalprobe archivieren', () => {
  it('@W5-027 die Kopie steht vor dem Archivieren auf der Startseite, danach im Archiv und nicht mehr dort', async () => {
    const kopie = gespielteKopie();
    expect(categorizeTournament(kopie, JETZT)).toBe('upcoming');

    const onUpdate = renderDangerZone(kopie);
    await archivieren();

    const archiviert = onUpdate.mock.calls[0][0] as Tournament;
    expect(archiviert.id).toBe(kopie.id);
    const kategorien = getExtendedCategories([archiviert], JETZT);
    expect(kategorien.finished.map((t) => t.id)).toEqual([kopie.id]);
    expect(kategorien.upcoming).toEqual([]);
    expect(kategorien.running).toEqual([]);
    expect(kategorien.trashed).toEqual([]);
    // gelöscht ist sie nicht: kein Papierkorb-Vermerk
    expect(archiviert.deletedAt).toBeUndefined();
  });

  it('@W5-027 das Original bleibt mit allen Spielen, Helfern und Bildschirmen unverändert und wird nicht gespeichert', async () => {
    const original = hallencupOstGespielt();
    const kopie = buildCopiedTournament(original, {
      newId: crypto.randomUUID(), title: 'Hallencup Ost (Probe)', now: '2026-11-20T10:00:00.000Z', makeId: () => crypto.randomUUID(),
    });
    const onUpdate = renderDangerZone(kopie);
    await archivieren();

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect((onUpdate.mock.calls[0][0] as Tournament).id).not.toBe(OST_ID);
    expect(original).toEqual(hallencupOstGespielt());
    expect(original.monitors).toHaveLength(1);
  });

  // Gegenbeispiel: die Löschsperre @LZ-003/@LZ-090 gilt auch für die Probe-Kopie, sobald ein Spiel angepfiffen wurde
  it('@W5-027 Gegenbeispiel: die gespielte Kopie lässt sich weiterhin nicht löschen', () => {
    renderDangerZone(gespielteKopie());
    expect(screen.queryByRole('button', { name: /Turnier löschen/i })).not.toBeInTheDocument();
  });
});
