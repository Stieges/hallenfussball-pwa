/**
 * Was ein Helfer-Gerät im Turnier darf – abgeleitet aus dem Zugangsstatus des Servers (A-17c, Plan GA5 v2.1 § 3.2).
 * Reine Funktionen ohne React. Die Zuordnung Server → Anzeige steht in `helperAccessView` (A-16); hier kommt nur die
 * Folge fürs Turnier-Fenster dazu: Eintragen erlaubt, wartet, abgelehnt, entzogen, nur zusehen, abgeschlossen.
 *
 * Szenarien: @HE-055 (Entzug/Zuschauer), @HE-070 (nach Abschluss), @HE-098 (Wiedereinstieg), @OB-053 (Anfrage-Stand).
 */
import {
  helperAccessView,
  type HelperAccessEntry,
  type HelperAccessStatus,
  type HelperAccessView,
} from '../../core/repositories/helperAccessRpc';
import { withDerivedClosed } from './joinFlow';

export type HelperAccessOutcome =
  /** Zugelassen, Turnier läuft: Eintragen erlaubt (Feld, ohne Zuteilung Feld 1). */
  | { kind: 'allowed'; field: number }
  /** @OB-053: Anfrage offen. */
  | { kind: 'pending'; checkNumber: number | null }
  /** @OB-053: Anfrage abgelehnt. */
  | { kind: 'declined' }
  /** Anfrage verfallen (Code abgelaufen, bevor entschieden wurde). */
  | { kind: 'expired' }
  /** @HE-055 Zeile 1: Zugang entzogen. */
  | { kind: 'noAccess' }
  /** @HE-055 Zeile 2: nur noch zusehen. */
  | { kind: 'watchOnly' }
  /** @HE-070: Turnier abgeschlossen, Endstand lesbar, kein Eintrag. */
  | { kind: 'closed' }
  /** Keine Beziehung dieses Geräts zum Turnier (eigenes Turnier, Leitung, Konto): nichts sperren. */
  | { kind: 'none' };

/** Endzustände, bei denen sich nichts mehr von allein ändert: die Abfrage hört auf (Egress, R10). */
const TERMINAL: ReadonlySet<HelperAccessOutcome['kind']> = new Set(['declined', 'expired', 'noAccess', 'closed', 'none']);

export function isTerminalOutcome(outcome: HelperAccessOutcome): boolean {
  return TERMINAL.has(outcome.kind);
}

/** Folge aus der Anzeige-Zuordnung des Servers. Alles ohne Beziehung des Geräts heißt `none`. */
export function outcomeFromView(view: HelperAccessView): HelperAccessOutcome {
  switch (view.view) {
    case 'openField':
      return { kind: 'allowed', field: view.field };
    case 'waiting':
      return { kind: 'pending', checkNumber: view.checkNumber };
    case 'declined':
      return { kind: 'declined' };
    case 'requestExpired':
      return { kind: 'expired' };
    case 'noAccess':
      return { kind: 'noAccess' };
    case 'watchOnly':
      return { kind: 'watchOnly' };
    case 'finalStandings':
      return { kind: 'closed' };
    default:
      return { kind: 'none' };
  }
}

export function viewFromStatus(info: HelperAccessStatus): HelperAccessView {
  return helperAccessView({ source: 'info', info: withDerivedClosed(info), session: 'device' });
}

export function outcomeFromStatus(info: HelperAccessStatus): HelperAccessOutcome {
  return outcomeFromView(viewFromStatus(info));
}

/** Stand aus dem Zugangs-Index des Geräts (ohne Netz, sofort): Wegweiser, das Recht prüft immer der Server. */
export function outcomeFromEntry(entry: HelperAccessEntry): HelperAccessOutcome {
  switch (entry.relation) {
    case 'accepted':
      return entry.closed ? { kind: 'closed' } : { kind: 'allowed', field: entry.field ?? 1 };
    case 'pending':
      return { kind: 'pending', checkNumber: entry.checkNumber };
    case 'viewer':
      return { kind: 'watchOnly' };
    case 'revoked':
      return { kind: 'noAccess' };
    case 'declined':
      return { kind: 'declined' };
    case 'expired':
      return { kind: 'expired' };
  }
}
