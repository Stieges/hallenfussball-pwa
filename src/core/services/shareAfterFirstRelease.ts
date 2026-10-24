/**
 * @W1-020 / @W1-037 (Befund C-FESTLEGEN-TEILT-NICHT): Beim ERSTEN Festlegen eines Konto-Turniers mit Netz wird es ueber
 * denselben Weg geteilt wie unter Admin -> Sichtbarkeit (`makeTournamentPublic`, RPC `make_tournament_public`).
 * Den Teilen-Code liefert der Server; er ersetzt den lokal erzeugten (derselbe Code gilt danach auf Geraet und in der Cloud).
 *
 * Nicht teilen: bereits festgelegtes Turnier (auch ein bewusst privat gestelltes), Gast, ohne Netz, anonymes Konto --
 * `mayShare` ist die Entscheidung der Vorschau (`publishNoticeKey === 'publish.explanationPublic'`).
 * Scheitert das Teilen, bleibt das Turnier festgelegt; der Aufrufer zeigt den Hinweis. Kein Wiederholen.
 */
import type { Tournament } from '../models/types';
import type { ITournamentRepository } from '../repositories/ITournamentRepository';

export type ShareOutcome =
  | { status: 'skipped'; tournament: Tournament }
  | { status: 'shared'; tournament: Tournament }
  | { status: 'failed'; tournament: Tournament };

export interface ShareAfterFirstReleaseInput {
  /** Das Turnier hatte vor diesem Festlegen kein `publishedAt`. */
  firstRelease: boolean;
  /** Angemeldet (kein Gast, kein anonymes Konto), Cloud eingerichtet und Netz da. */
  mayShare: boolean;
}

export async function shareAfterFirstRelease(
  repository: ITournamentRepository,
  published: Tournament,
  { firstRelease, mayShare }: ShareAfterFirstReleaseInput,
): Promise<ShareOutcome> {
  if (!firstRelease || !mayShare || !published.isPublic) {
    return { status: 'skipped', tournament: published };
  }
  try {
    const result = await repository.makeTournamentPublic(published.id, { requireCloud: true });
    if (!result) {
      return { status: 'failed', tournament: published };
    }
    return {
      status: 'shared',
      tournament: { ...published, isPublic: true, shareCode: result.shareCode, shareCodeCreatedAt: result.createdAt },
    };
  } catch {
    return { status: 'failed', tournament: published };
  }
}
