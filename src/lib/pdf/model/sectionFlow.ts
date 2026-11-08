/**
 * Verteilung der Abschnitte nach den Gruppenspielen auf Seiten (@DR-002). Rein. Reihenfolge: Tabellen (neue Seite), Finalrunde,
 * Platzierung. Finalrunde und Platzierung folgen auf der Seite der Tabellen, wenn sie dort ganz Platz haben, sonst auf einer
 * neuen Seite (`finalsOnTablesPage`); ohne Tabellen beginnt die Finalrunde auf einer neuen Seite, eine Platzierung ohne Finalrunde
 * folgt, wo sie ganz hineinpasst. Ein Abschnitt ohne Inhalt entfällt. Im Endstand beginnen Finalrunde und Siegerehrung je auf einer neuen
 * Seite, die Platzliste steht nur auf der Siegerehrung (@DR-052, @DR-054).
 */
import { printGap } from '../../../design-tokens/print';
import { finalsOnTablesPage } from './pagePlan';
import type { Block, PageSection } from './types';

/** Ein Baustein, dessen Höhe feststeht, bevor seine Lage bekannt ist; `build` setzt ihn ab `top` (mm). */
export interface Placeable { height: number; build: (top: number) => Block[] }

/** Ein Abschnitt, der als Ganzes eine Seite füllen kann: Gesamthöhe und, falls er nicht auf eine Seite passt, Teile zwischen Runden bzw. Zeilen. */
export interface Splittable { height: number; chunks: (capacity: number) => Placeable[] }

export interface SectionParts {
  tables: Placeable[];
  finals?: Splittable;
  ranking?: Splittable;
  /** Endstand (@DR-054): die Finalrunde beginnt immer auf einer neuen Seite, auch wenn sie auf die Seite der Tabellen passte. */
  finalsOwnPage?: boolean;
  /** Endstand (@DR-052): Seite „Siegerehrung“, beginnt immer auf einer neuen Seite und ersetzt die Platzierung. */
  ceremony?: Splittable;
}

/** Eine Seite im Aufbau: `y` ist die nächste freie Höhe. */
export interface FlowPage { section: PageSection; blocks: Block[]; y: number }

export interface Frame { top: number; bottom: number }

/**
 * Hängt die Abschnitte an die Seiten der Gruppenspiele an (`pages`; die letzte wird nur für eine Platzierung ohne Tabellen und
 * ohne Finalrunde weiter gefüllt). Rückgabe: alle Seiten.
 */
export function flowSections(pages: FlowPage[], parts: SectionParts, frame: Frame): FlowPage[] {
  const all = [...pages];
  const gap = printGap.sectionGap;
  let cur: FlowPage | undefined = all.at(-1);
  const open = (section: PageSection): FlowPage => {
    cur = { section, blocks: [], y: frame.top };
    all.push(cur);
    return cur;
  };
  const room = (page: FlowPage, height: number): boolean => page.y + (page.blocks.length > 0 ? gap : 0) + height <= frame.bottom;
  const put = (item: Placeable, section: PageSection): void => {
    const page = cur && room(cur, item.height) ? cur : open(section);
    page.y += page.blocks.length > 0 ? gap : 0;
    page.blocks.push(...item.build(page.y));
    page.y += item.height;
  };

  parts.tables.forEach((item, index) => {
    if (index === 0) { open('tables'); }
    put(item, 'tables');
  });
  if (parts.finals) {
    const capacity = frame.bottom - frame.top;
    const onTables = parts.finalsOwnPage !== true && parts.tables.length > 0 && cur !== undefined && finalsOnTablesPage(frame.bottom - cur.y - gap, parts.finals.height, parts.ranking?.height ?? 0, gap);
    if (!onTables) { open('finals'); }
    parts.finals.chunks(capacity).forEach((chunk, index) => {
      if (index > 0) { open('finals'); }
      put(chunk, 'finals');
    });
  }
  parts.ranking?.chunks(frame.bottom - frame.top).forEach(chunk => put(chunk, 'ranking'));
  parts.ceremony?.chunks(frame.bottom - frame.top).forEach(chunk => {
    open('ceremony');
    put(chunk, 'ceremony');
  });
  return all;
}
