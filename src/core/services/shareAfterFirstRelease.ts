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
      return { status: 'failed', tournament: withoutLocalOnlyLink(published) };
    }
    return {
      status: 'shared',
      tournament: { ...published, isPublic: true, shareCode: result.shareCode, shareCodeCreatedAt: result.createdAt },
    };
  } catch {
    return { status: 'failed', tournament: withoutLocalOnlyLink(published) };
  }
}

/**
 * Scheitert das Teilen, kennt die Cloud den lokal erzeugten Code nie. Der lokale Stand folgt der Wahrheit: privat, kein Code.
 * Sonst zeigten Sichtbarkeit, Teilen-Dialog, QR und Monitor-Editor einen toten Link, und „Mit Link teilbar“ liesse sich nicht
 * mehr antippen, um das Teilen nachzuholen.
 */
function withoutLocalOnlyLink(published: Tournament): Tournament {
  const { shareCode: _code, shareCodeCreatedAt: _createdAt, ...rest } = published;
  return { ...rest, isPublic: false };
}
