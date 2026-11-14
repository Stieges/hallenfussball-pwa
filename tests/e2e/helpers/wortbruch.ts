/**
 * Wortbruch im Browser messen (@ZM-207, @OB-025): ein „Wort“ ist ein Stück Text zwischen Leerzeichen, und nach einem Schrägstrich zwischen Buchstaben
 * beginnt ein neues Wort. Ein Wort, das über mehr als eine Zeile läuft, ist zerrissen („Ten-gling“). Misst die gerenderte Lage jedes Zeichens, nicht den Quelltext.
 * Gleiche Regel wie `titel.wortbruch` in `scripts/visual-metrics/browser-messung.mjs`.
 */
import type { Page } from '@playwright/test';

export interface NamensLage {
  text: string;
  /** Der Name steht in einem Element mit `data-teamname` (Markierung für `npm run visual:metrics`) */
  markiert: boolean;
  /** Zeilen des Namens, wie sie gesetzt sind (ohne Randleerzeichen) */
  zeilen: string[];
  /** Wörter, die über mehr als eine Zeile laufen */
  zerrissen: string[];
}

/**
 * Lage aller sichtbaren Namen, die `enthaelt` tragen: gemessen wird das kleinste Element, das den Text ganz enthält, unabhängig von Markierungen
 * (so fängt der Test auch Stellen, an denen `data-teamname` fehlt). `bereich` begrenzt die Suche (Vorgabe: die ganze Seite), `ohne` nimmt Teile aus.
 */
export async function namensLagen(page: Page, enthaelt: string, bereich = 'body', ohne = ''): Promise<NamensLage[]> {
  return page.evaluate(({ bereich: wurzel, enthaelt: teil, ohne: ausgenommen }) => {
    const aus: Array<{ text: string; markiert: boolean; zeilen: string[]; zerrissen: string[] }> = [];
    const kandidaten = [...document.querySelectorAll<HTMLElement>(`${wurzel} *`)].filter((e) => (e.textContent ?? '').includes(teil) && ![...e.children].some((k) => (k.textContent ?? '').includes(teil)));
    for (const el of kandidaten) {
      const r0 = el.getBoundingClientRect();
      if (r0.width <= 1 || r0.height <= 1 || el.closest('[hidden], [aria-hidden="true"]') !== null) { continue; }
      if (ausgenommen !== '' && el.closest(ausgenommen) !== null) { continue; }
      const zeichen: Array<{ c: string; top: number }> = [];
      const gang = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const bereich = document.createRange();
      for (let knoten = gang.nextNode(); knoten !== null; knoten = gang.nextNode()) {
        const text = knoten.textContent ?? '';
        for (let i = 0; i < text.length; i++) {
          bereich.setStart(knoten, i);
          bereich.setEnd(knoten, i + 1);
          const rechtecke = bereich.getClientRects();
          const hoehe = rechtecke.length > 0 ? rechtecke[0].height : 0;
          if (rechtecke.length === 0 || /\s/.test(text[i]) && hoehe === 0) { zeichen.push({ c: text[i], top: Number.NaN }); continue; }
          zeichen.push({ c: text[i], top: Math.round(rechtecke[0].top) });
        }
      }
      // Zeilen: jede Änderung der Oberkante (sichtbare Zeichen) beginnt eine neue Zeile
      const zeilen: string[] = [];
      let aktuell = '';
      let letzte = Number.NaN;
      for (const z of zeichen) {
        if (!Number.isNaN(z.top) && !Number.isNaN(letzte) && Math.abs(z.top - letzte) > 4) { zeilen.push(aktuell.trim()); aktuell = ''; }
        aktuell += z.c;
        if (!Number.isNaN(z.top)) { letzte = z.top; }
      }
      zeilen.push(aktuell.trim());
      // Wörter: zwischen Leerzeichen, neues Wort nach „/“ vor einem Nicht-Leerzeichen
      const zerrissen: string[] = [];
      let wort = '';
      const tops = new Set<number>();
      const schliesse = () => { if (wort !== '' && tops.size > 1) { zerrissen.push(wort); } wort = ''; tops.clear(); };
      zeichen.forEach((z, i) => {
        if (/\s/.test(z.c)) { schliesse(); return; }
        wort += z.c;
        if (!Number.isNaN(z.top)) { tops.add(z.top); }
        if (z.c === '/' && i + 1 < zeichen.length && !/[\s/]/.test(zeichen[i + 1].c)) { schliesse(); }
      });
      schliesse();
      aus.push({ text: el.textContent ?? '', markiert: el.closest('[data-teamname]') !== null, zeilen: zeilen.filter((z) => z !== ''), zerrissen });
    }
    return aus;
  }, { bereich, enthaelt, ohne });
}

/** Läuft etwas über den rechten Rand der Seite hinaus (waagerechtes Scrollen)? */
export async function seitenUeberlauf(page: Page): Promise<number> {
  return page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
}
