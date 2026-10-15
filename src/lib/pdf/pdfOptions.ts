/**
 * Optionen des Spielplan-PDFs (`schedulePdf.ts`). Nur Typen.
 */
import type { Tournament } from '../../types/tournament';
import type { LogoImage } from '../images/logoBytes';
import type { PdfOrientation } from './layout';
import type { RankEntry } from './placement';
import type { PdfAudience } from './visibility';
import type { PdfLocale, PdfTranslator } from './translations';

export interface PDFExportOptions {
  /**
   * Sprache des Dokuments (@DR-022: Ausdrucke folgen durchgängig dieser Sprache, auch der Aushang). Die Sprache kommt
   * nur über `PdfInput.locale`; nur `toPdfInput` setzt sie ersatzweise aus der App-Sprache (Vorbereitung @DR-028: Wahl im Dialog).
   */
  locale?: PdfLocale;
  /** Übersetzer für `pdf.*`. Vorgabe: i18next der App; Tests reichen die Ressource durch. */
  translate?: PdfTranslator;
  includeStandings?: boolean;
  includeScores?: boolean;
  /**
   * Zielgruppe (B-28 C5, @BM-032): `organizer` (Vorgabe) oder `viewer` („Nur Spielplan“). Die Schalter des Turniers
   * „Ergebnisse“ und „Gruppentabellen“ wirken in beiden Fällen und begrenzen `includeScores`/`includeStandings` (`visibility.ts`).
   */
  audience?: PdfAudience;
  organizerName?: string;
  hallName?: string;
  /** Ausrichtung des A4-Blatts. Vorgabe: hoch. */
  orientation?: PdfOrientation;
  /**
   * Fassung (B-28a3-3b, @BM-052): `plan` = „Spielplan“ (Vorgabe), `blank` = „Spielplan zum Ausfüllen“. Nur der Wunsch
   * des Nutzers ergibt `blank`; ohne Ergebnisse allein bleibt es bei `plan`. `final` = Endstand (Anschluss C10): die
   * Fußzeile trägt mit `closedAt` die Abschlusszeile statt des Stands.
   */
  edition?: 'plan' | 'blank' | 'final';
  /**
   * Gespeicherter Endstand (alle Teams in der Reihenfolge der Plätze) und Abschluss des Turniers (B-28 C2, @DR-009).
   * Bis A-19/A-21a fehlen beide: die Platzierung bleibt offen. Die Fassung zum Ausfüllen zeigt nie einen Endstand.
   */
  ranking?: RankEntry[];
  closed?: boolean;
  /** Zeitpunkt des Stands in der Fußzeile und im Dateinamen. Vorgabe: jetzt. Tests reichen einen festen Zeitpunkt durch. */
  now?: Date;
  /** Hat das Gerät Netz? Vorgabe: ja. Ohne Netz trägt jede Fußzeile den Zusatz „– ohne Verbindung …“ (@BM-023). Lieferant: C8. */
  online?: boolean;
  /** Abschluss des Turniers für die Fassung `final` (Anschluss C10). */
  closedAt?: Date;
  /**
   * Ansprechpartner als fertiger Text. Wird nur gedruckt, wenn der Aufrufer ihn übergibt; das tut er nur bei gesetztem
   * Häkchen „Ansprechpartner öffentlich zeigen“ (@W1-031, @W1-032). Leer oder nur Leerraum: keine Zeile.
   */
  contact?: string;
  /**
   * Grafik links (Veranstalter) und rechts (z. B. Sponsor) im Kopf, bereits geladene Bilddaten (@DR-023/@DR-024; Laden und
   * Hochladen: A-29). Je höchstens 20 mm hoch. Unbrauchbare Daten: das PDF entsteht ohne die Grafik, `notes` meldet es.
   */
  logoLeft?: LogoImage;
  logoRight?: LogoImage;
  /** Zuschauer sehen keine Ergebnisse: die Beschriftung des QR lautet dann „Spielplan aufs Handy“ (@DR-010). Vorgabe: nein. */
  viewerResultsHidden?: boolean;
  /** Ursprung der Zuschauer-Adresse im QR (`https://…`). Vorgabe: Ursprung der App; Tests ohne `window` setzen ihn. */
  viewerBaseUrl?: string;
  /** Turnier für die Regelzeilen im Kopf und die K.-o.-Zeilen (B-28a3-3b, Fixrunde W6). Pflicht. */
  tournament: Tournament;
}
