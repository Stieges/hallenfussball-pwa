/**
 * @W2A-077 (R2 PR 1, Probe K5 im Nachreview Version-Fix): Welche Server-Versionen eines Turniers hat dieses Gerät selbst
 * durch eine Gleichstands-Entscheidung erzeugt (`record_standing_decision`, `complete_group` mit neuer Entscheidung)?
 *
 * Scheitert danach ein Voll-Speichern aus einer älteren Ansicht als Versionskonflikt und ist die Version direkt nach seiner
 * Basis eine eigene Entscheidung, nennt die App als Grund die eigene Entscheidung statt „anderes Gerät“. Die Merkung lebt
 * getrennt von der Turnier-Kopie, weil eine Übernahme aus der Cloud die Kopie neu baut. Speicherfehler sind harmlos: dann
 * gilt der bisherige Grund. Rein, ohne React.
 */
import { safeLocalStorage } from '../utils/safeStorage';

const KEY = 'hf.ownDecisionVersions.v1';
/** Je Turnier genügen die jüngsten Versionen; ältere Ansichten liegen nie so weit zurück. */
const KEEP = 20;

type Store = Record<string, number[]>;

function read(): Store {
  try {
    const raw = safeLocalStorage.getItem(KEY);
    const parsed: unknown = raw === null ? {} : JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const store: Store = {};
    for (const [id, list] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(list)) {
        store[id] = list.filter((v): v is number => Number.isInteger(v));
      }
    }
    return store;
  } catch {
    return {};
  }
}

/** Merkt sich, dass `version` von einer eigenen Gleichstands-Entscheidung stammt. */
export function rememberOwnDecisionVersion(tournamentId: string, version: number): void {
  if (!Number.isInteger(version)) {
    return;
  }
  try {
    const store = read();
    const list = [...new Set([...(store[tournamentId] ?? []), version])].sort((a, b) => a - b).slice(-KEEP);
    safeLocalStorage.setItem(KEY, JSON.stringify({ ...store, [tournamentId]: list }));
  } catch {
    // Merkung ist nur für den Wortlaut des Grunds da – ohne sie gilt der bisherige Text
  }
}

/**
 * Stammt die Server-Version direkt nach `base` von einer eigenen Gleichstands-Entscheidung?
 * Bekannte Grenze (Review #382 N4): Lag danach noch eine fremde Änderung (`base + 2`), nennt der Grund trotzdem die eigene
 * Entscheidung – der Konfliktfehler trägt die aktuelle Server-Version nicht. Für das MVP hingenommen; der Text bleibt wahr
 * („hat sich … geändert“), er verschweigt nur die zweite Änderung. Die Merkung gilt je Gerät, nicht je Konto (N6).
 */
export function nextVersionIsOwnDecision(tournamentId: string, base: number | undefined): boolean {
  return base !== undefined && (read()[tournamentId] ?? []).includes(base + 1);
}
