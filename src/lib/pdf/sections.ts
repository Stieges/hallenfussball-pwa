/**
 * Abschnitte des Spielplan-PDFs: laufende Nummern im Titel („1 Teilnehmer“, „2 Gruppenphase“ …) und die Frage, welcher
 * Abschnitt oben auf einer Folgeseite steht (Kurzkopf, G8). Nur Rechnen und Merken, kein Zeichnen.
 *
 * Nummeriert wird fortlaufend über die vorhandenen Abschnitte: fehlt einer (keine Tabellen, keine Finalrunde), rückt
 * die Zählung auf. Nur der erste Titel eines Abschnitts trägt die Nummer (bei Tabellen der erste Gruppentitel, bei der
 * Finalrunde die erste Runde).
 */
import type { jsPDF } from 'jspdf';
import { printType } from '../../design-tokens/print';
import { ascentMm, continuationTop, type PageGeometry } from './layout';

export type SectionKey = 'participants' | 'groupStage' | 'tables' | 'finals' | 'ranking';

/** Zugang eines Renderers zu seinem Abschnitt. */
export interface SectionHandle {
  /** Merkt, dass der Abschnitt auf der aktuellen Seite bei `y` (Grundlinie des ersten Titels) beginnt. Einmal wirkt. */
  begin(doc: jsPDF, y: number): void;
  /** Titel mit Nummer beim ersten Aufruf, danach ohne. Beginnt den Abschnitt, falls noch nicht geschehen. */
  heading(doc: jsPDF, y: number, text: string): string;
}

export interface SectionPlan {
  handle(key: SectionKey): SectionHandle;
  /** Abschnitt, der oben auf `page` (ab 2) steht; `undefined`, wenn keiner begonnen hat. */
  keyAtTop(page: number): SectionKey | undefined;
}

interface Mark {
  key: SectionKey;
  page: number;
  atTop: boolean;
}

/** „3 Tabelle – Gruppe A“ */
export function numberedTitle(number: number, text: string): string {
  return `${number} ${text}`;
}

/** Plan der vorhandenen Abschnitte in Reihenfolge. */
export function planSections(present: SectionKey[], geo: PageGeometry): SectionPlan {
  const marks: Mark[] = [];
  const used = new Set<SectionKey>();

  const handle = (key: SectionKey): SectionHandle => {
    const number = present.indexOf(key) + 1;
    const begin = (doc: jsPDF, y: number): void => {
      if (marks.some(mark => mark.key === key)) {
        return;
      }
      // Oben auf der Seite: die Titelgrundlinie liegt auf der Oberkante des Satzspiegels der Folgeseite plus Oberlänge
      const atTop = y - ascentMm(printType.h2) <= continuationTop(geo) + 1;
      // Seiten entstehen nur am Ende (`addPage`), die aktuelle Seite ist die letzte
      marks.push({ key, page: doc.getNumberOfPages(), atTop });
    };
    return {
      begin,
      heading(doc, y, text) {
        begin(doc, y);
        if (used.has(key)) {
          return text;
        }
        used.add(key);
        return numberedTitle(number, text);
      },
    };
  };

  const keyAtTop = (page: number): SectionKey | undefined => {
    const before = marks.filter(mark => mark.page < page || (mark.page === page && mark.atTop));
    return before.at(-1)?.key;
  };

  return { handle, keyAtTop };
}
