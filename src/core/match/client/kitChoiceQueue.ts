/**
 * Warteschlange der Leibchen-Wahl (Leibchen 2b, Punkt 3): schickt „Bestätigen“ / „Keine Leibchen“ / Nachtragen über `match_kit_set`.
 * Framework-frei (LAYERING core), alle Abhängigkeiten injiziert.
 *
 * - Je Spiel höchstens EIN Eintrag: die zuletzt getippte Wahl ersetzt die vorige, auch eine noch wartende („nie Gelb nach Orange“, @SL-202 Zeile 4).
 * - Ohne Netz wartet der Eintrag (`pending`, „wird gesendet“) und geht beim nächsten `flush()` raus; er übersteht das Neuladen (@SL-216).
 *   Angekommen ist er `sent` („gesendet“, @SL-230) – bis die Zeile des Spiels (Server) nachzieht (`reconcile`).
 * - Weist der Server ab, verschwindet der Eintrag (das Gerät nimmt die Weste zurück) und eine Meldung bleibt stehen (@SL-229); dasselbe bei einem
 *   anderen Gerät, das inzwischen etwas anderes bestätigt hat (@SL-228).
 * - Doppeltipp: dieselbe Wahl zweimal in kurzer Folge bleibt EIN Eintrag und EINE Sendung (@SL-221).
 * Die Anzeige legt die Einträge mit `applyKitChoices` über die Turnierkopie (lokale Wahl sofort sichtbar, Monitor und Zuschauer erst vom Server).
 */
import type { KitDecision, KitSide } from '../../models/kit';
import type { MatchKitRejectionCode, MatchKitSetArgs, MatchKitSetResult } from '../../repositories/matchKitSetRpc';

export interface KitChoiceInput {
  matchId: string;
  decision: KitDecision;
  bibSide?: KitSide | undefined;
  bibColor?: string | undefined;
  /** Die Teams, die das Gerät beim Wählen auf den Seiten sah. */
  teams?: { a: string; b: string } | undefined;
  deviceId?: string | undefined;
  controlEpoch?: number | null | undefined;
  /**
   * Zustand des Spiels beim Tippen: `before` = noch nicht angepfiffen, `live` = Nachtrag im laufenden Spiel (@SL-150). Eine Wahl vor dem Anpfiff darf nach
   * einem Anpfiff nicht mehr als Nachtrag beim Server ankommen und das Leibchen des Anpfiffs überschreiben (@SL-229 Zeile 1). Fehlt es: `before`.
   */
  phase?: 'before' | 'live' | undefined;
}

export type KitChoiceStatus = 'pending' | 'sent';

export interface KitChoiceEntry extends KitChoiceInput {
  /** Fortlaufend; die höhere Nummer ist die jüngere Wahl. */
  seq: number;
  status: KitChoiceStatus;
  /** Stand der Zeile (Server), als der Eintrag losging – damit eine fremde Änderung erkannt wird (@SL-228). */
  base?: KitRowState | undefined;
}

/** Was die Zeile des Spiels (Server) zur Wahl sagt; `decision` fehlt = offen. */
export interface KitRowState {
  decision?: KitDecision | undefined;
  bibSide?: KitSide | undefined;
  bibColor?: string | undefined;
  teams?: { a: string | undefined; b: string | undefined } | undefined;
  /** Die Zeile zeigt das Spiel als angepfiffen (`running`/`paused`). */
  kickedOff?: boolean | undefined;
}

type KitChoiceNoticeBody =
  | { matchId: string; kind: 'rejected'; code: MatchKitRejectionCode; reason?: string; hadControl?: boolean }
  | { matchId: string; kind: 'failed' }
  | { matchId: string; kind: 'changedElsewhere' }
  /** Das Spiel wurde angepfiffen, bevor die Wahl den Server erreichte (@SL-229 Zeile 1). */
  | { matchId: string; kind: 'tooLate' }
  /** Der Server hat die Wahl zurückgenommen, weil ein anderes Team auf eine Seite kam (@SL-212, @SL-235). */
  | { matchId: string; kind: 'withdrawn' };

/** Meldung, die stehen bleibt, bis sie weggetippt oder die Wahl neu getroffen wird (@SL-228, @SL-229). */
export type KitChoiceNotice = KitChoiceNoticeBody & { id: string };

export interface KitChoiceStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export interface KitChoiceDeps {
  send: (args: MatchKitSetArgs) => Promise<MatchKitSetResult>;
  storage: KitChoiceStorage;
  /** Konto (und Gerät) im Speicherschlüssel: ein Kontowechsel sieht fremde Einträge nicht. */
  storageKey: string;
  now: () => number;
}

const STORAGE_PREFIX = 'hf-kit-choices-v1:';

type Stored = { entries: KitChoiceEntry[]; seq: number };

function isStored(value: unknown): value is Stored {
  return typeof value === 'object' && value !== null && Array.isArray((value as Stored).entries) && typeof (value as Stored).seq === 'number';
}

function sameChoice(entry: KitChoiceEntry, row: KitRowState): boolean {
  if (entry.decision === 'none') {
    return row.decision === 'none';
  }
  return row.decision === 'bib' && row.bibSide === entry.bibSide && row.bibColor?.toUpperCase() === entry.bibColor?.toUpperCase();
}

function sameRow(left: KitRowState | undefined, right: KitRowState): boolean {
  return left?.decision === right.decision && left?.bibSide === right.bibSide && left?.bibColor?.toUpperCase() === right.bibColor?.toUpperCase();
}

export class KitChoiceQueue {
  private list: KitChoiceEntry[] = [];
  private noticeList: KitChoiceNotice[] = [];
  private seq = 0;
  private noticeSeq = 0;
  private flushing = false;
  private readonly seenDecision = new Set<string>();
  private localStarts: ReadonlySet<string> = new Set();
  private readonly listeners = new Set<() => void>();

  constructor(private readonly deps: KitChoiceDeps) {
    this.load();
  }

  entries(): readonly KitChoiceEntry[] {
    return this.list;
  }

  notices(): readonly KitChoiceNotice[] {
    return this.noticeList;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Die Wahl vormerken (ersetzt die vorige desselben Spiels); gesendet wird mit `flush()`. */
  submit(input: KitChoiceInput, base?: KitRowState): void {
    const vorige = this.list.find((entry) => entry.matchId === input.matchId);
    if (vorige?.status === 'pending' && this.sameInput(vorige, input)) {
      return; // Doppeltipp: dieselbe Wahl wartet schon (@SL-221)
    }
    this.seq += 1;
    const entry: KitChoiceEntry = { ...input, seq: this.seq, status: 'pending', base: base ?? vorige?.base };
    this.list = [...this.list.filter((e) => e.matchId !== input.matchId), entry];
    this.dropNotices(input.matchId);
    this.changed();
  }

  /**
   * Alle wartenden Einträge senden, bis nichts mehr wartet (auch eine Wahl, die während einer Sendung dazukommt, @SL-202, @SL-230). Ohne Netz bleibt der
   * Rest liegen; es läuft nie zweimal gleichzeitig.
   */
  async flush(): Promise<void> {
    if (this.flushing) {
      return;
    }
    this.flushing = true;
    try {
      for (;;) {
        const entry = this.list.filter((e) => e.status === 'pending').sort((a, b) => a.seq - b.seq)[0];
        if (entry === undefined) {
          return;
        }
        const result = await this.deps.send(this.toArgs(entry));
        if (result.kind === 'offline') {
          return;
        }
        this.settle(entry, result);
      }
    } finally {
      this.flushing = false;
    }
  }

  /**
   * Die Zeilen der Spiele (Server) gegen die Einträge halten. Gesendete Einträge verschwinden, sobald die Zeile unsere Wahl zeigt (kein Hinweis) oder
   * eine andere (Hinweis „von einem anderen Gerät geändert“, @SL-228); solange die Zeile noch den Stand von vor unserer Sendung zeigt, bleibt der Eintrag.
   * Stehen im Spiel andere Teams, als das Gerät beim Wählen sah, ist die Wahl zurückgenommen (@SL-212, @SL-229).
   */
  reconcile(rows: ReadonlyMap<string, KitRowState>): void {
    let geaendert = false;
    for (const entry of [...this.list]) {
      const row = rows.get(entry.matchId);
      if (row === undefined) {
        continue;
      }
      if (entry.status === 'pending' && (entry.phase ?? 'before') === 'before' && row.kickedOff === true && !this.localStarts.has(entry.matchId)) {
        // @SL-229 Zeile 1: ein anderes Gerät hat angepfiffen; unsere alte Wahl käme als Nachtrag an und überschriebe das Leibchen des Anpfiffs
        this.remove(entry);
        this.notify({ matchId: entry.matchId, kind: 'tooLate' });
        geaendert = true;
      } else if (entry.teams !== undefined && row.teams !== undefined && (row.teams.a !== entry.teams.a || row.teams.b !== entry.teams.b)) {
        this.remove(entry);
        this.notify({ matchId: entry.matchId, kind: 'rejected', code: 'TEAMS_CHANGED' });
        geaendert = true;
      } else if (entry.status === 'sent') {
        if (sameChoice(entry, row)) {
          this.remove(entry);
          geaendert = true;
        } else if (entry.base !== undefined && !sameRow(entry.base, row)) {
          this.remove(entry);
          this.notify({ matchId: entry.matchId, kind: 'changedElsewhere' });
          geaendert = true;
        }
      }
    }
    if (geaendert) {
      this.changed();
    }
  }

  /**
   * Spiele, die dieses Gerät lokal angepfiffen hat und noch angepfiffen sind (nach „Anpfiff rückgängig“ nicht mehr, @SL-214): ein wartender Eintrag vor
   * dem Anpfiff entfällt still, denn der Anpfiff trägt die Wahl im `kit` (`kitBeimAnpfiff`, @SL-202) – sonst käme sie als Nachtrag beim Server an und
   * würde als „nur Turnierleitung“ abgewiesen (@SL-150). Entscheidend ist der Zustand jetzt, nicht ob je ein Anpfiff im Log stand.
   */
  discardStarted(matchIds: ReadonlySet<string>): void {
    this.localStarts = new Set(matchIds);
    const rest = this.list.filter((entry) => !(entry.status === 'pending' && (entry.phase ?? 'before') === 'before' && matchIds.has(entry.matchId)));
    if (rest.length !== this.list.length) {
      this.list = rest;
      this.changed();
    }
  }

  /**
   * Die Zeilen (Server) aller Spiele mit Wahl: war eine Wahl da und ist nun weg, ohne dass dieses Gerät sie aufgegeben hat und ohne Anpfiff, hat der Server sie
   * zurückgenommen (anderes Team auf einer Seite, @SL-212): die Meldung „Leibchen zurückgenommen, bitte neu bestätigen“ steht da, statt dass die Karte still wiederkommt.
   */
  observeRows(rows: ReadonlyMap<string, KitRowState>): void {
    let neu = false;
    for (const [matchId, row] of rows) {
      if (row.decision !== undefined) {
        this.seenDecision.add(matchId);
      } else if (this.seenDecision.delete(matchId) && row.kickedOff !== true && !this.list.some((e) => e.matchId === matchId)) {
        this.notify({ matchId, kind: 'withdrawn' });
        neu = true;
      }
    }
    if (neu) { this.changed(); }
  }

  /** Spiele, deren Wahl zuletzt bekannt war (für `observeRows`). */
  decidedMatchIds(): readonly string[] {
    return [...this.seenDecision];
  }

  /** Alles verwerfen (Abmelden, Tests): Einträge, Meldungen und das Gemerkte. */
  reset(): void {
    this.list = [];
    this.noticeList = [];
    this.seenDecision.clear();
    this.localStarts = new Set();
    this.changed();
  }

  dismissNotice(id: string): void {
    const rest = this.noticeList.filter((notice) => notice.id !== id);
    if (rest.length !== this.noticeList.length) {
      this.noticeList = rest;
      this.changed();
    }
  }

  private sameInput(entry: KitChoiceEntry, input: KitChoiceInput): boolean {
    return entry.decision === input.decision && entry.bibSide === input.bibSide && entry.bibColor === input.bibColor;
  }

  private toArgs(entry: KitChoiceEntry): MatchKitSetArgs {
    const { matchId, decision, bibSide, bibColor, teams, deviceId, controlEpoch } = entry;
    return { matchId, decision, bibSide, bibColor, teams, deviceId, controlEpoch };
  }

  private settle(entry: KitChoiceEntry, result: MatchKitSetResult): void {
    const aktuell = this.list.find((e) => e.matchId === entry.matchId);
    if (aktuell?.seq !== entry.seq) {
      return; // inzwischen ersetzt: das Ergebnis betrifft eine ältere Wahl
    }
    if (result.kind === 'saved') {
      this.list = this.list.map((e) => (e.seq === entry.seq ? { ...e, status: 'sent' as const } : e));
      if (result.phase === 'live' && (entry.phase ?? 'before') === 'before') {
        // @SL-229 Zeile 1: der Server hat die alte Wahl als Nachtrag ins laufende Spiel genommen (ein anderes Gerät hatte angepfiffen) – nicht stumm „gesendet“
        this.notify({ matchId: entry.matchId, kind: 'tooLate' });
      }
    } else {
      this.remove(entry);
      this.notify(result.kind === 'rejected'
        ? { matchId: entry.matchId, kind: 'rejected', code: result.code, ...(result.reason === undefined ? {} : { reason: result.reason }), hadControl: entry.controlEpoch !== undefined && entry.controlEpoch !== null }
        : { matchId: entry.matchId, kind: 'failed' });
    }
    this.changed();
  }

  private remove(entry: KitChoiceEntry): void {
    this.list = this.list.filter((e) => e.seq !== entry.seq);
  }

  private notify(notice: KitChoiceNoticeBody): void {
    this.noticeSeq += 1;
    this.noticeList = [...this.noticeList, { ...notice, id: `${this.deps.now()}-${this.noticeSeq}` }];
  }

  private dropNotices(matchId: string): void {
    this.noticeList = this.noticeList.filter((notice) => notice.matchId !== matchId);
  }

  private changed(): void {
    this.persist();
    this.listeners.forEach((listener) => listener());
  }

  private key(): string {
    return `${STORAGE_PREFIX}${this.deps.storageKey}`;
  }

  private persist(): void {
    try {
      this.deps.storage.set(this.key(), JSON.stringify({ entries: this.list, seq: this.seq } satisfies Stored));
    } catch {
      // Speicher voll oder gesperrt: die Wahl gilt in dieser Sitzung weiter
    }
  }

  private load(): void {
    try {
      const raw = this.deps.storage.get(this.key());
      const parsed: unknown = raw === null ? null : JSON.parse(raw);
      if (isStored(parsed)) {
        this.list = parsed.entries.filter((e) => typeof e.matchId === 'string' && (e.status === 'pending' || e.status === 'sent'));
        this.seq = parsed.seq;
      }
    } catch {
      // kaputter Inhalt: wie leer
    }
  }
}
