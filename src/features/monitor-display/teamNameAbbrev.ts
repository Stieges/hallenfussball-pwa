/**
 * Vereinskürzel am Monitor (MS1, @ZM-087, @ZM-149; Quelle: Record Zuschauer und Monitor, „Teamnamen am Monitor“).
 *
 * Ein hinterlegter Kurzname hat Vorrang. Sonst werden übliche Vereinswörter nach fester, erweiterbarer Liste
 * gekürzt: nur ganze Wörter bzw. Wortfolgen (Grenze = Wortanfang/-ende, kein `\b` wegen Umlauten), Groß- und
 * Kleinschreibung wie in der Liste, die längste passende Folge zuerst. Andere Kürzel (Anfangsbuchstaben) entstehen
 * nie. Zuschauer-Seite, Spielplan und PDF nutzen diese Funktion nicht (@ZM-148).
 * Jede Erweiterung der Liste braucht eine Lern-Spur-Zeile im Record.
 */

/** Wortfolge → Kürzel, sortiert nach Länge der Wortfolge (längste zuerst), danach nach Zeichenlänge. */
export const VEREINS_KUERZEL: readonly (readonly [string, string])[] = [
  ['Verein für Bewegungsspiele', 'VfB'],
  ['Turn- und Sportverein', 'TSV'],
  ['Fußballsportverein', 'FSV'],
  ['Sportgemeinschaft', 'SG'],
  ['Spielvereinigung', 'SpVgg'],
  ['Fußballfreunde', 'FF'],
  ['Fußballclub', 'FC'],
  ['Sportverein', 'SV'],
  ['Sportclub', 'SC'],
  ['Turnverein', 'TV'],
];

interface Eintrag {
  woerter: readonly string[];
  kuerzel: string;
}

/** Längste Wortfolge zuerst („Turn- und Sportverein“ vor „Sportverein“), unabhängig von der Reihenfolge oben. */
const EINTRAEGE: readonly Eintrag[] = VEREINS_KUERZEL
  .map(([folge, kuerzel]) => ({ woerter: folge.split(' '), kuerzel }))
  .sort((a, b) => b.woerter.length - a.woerter.length
    || b.woerter.join(' ').length - a.woerter.join(' ').length);

function folgeBei(woerter: readonly string[], start: number, eintrag: Eintrag): boolean {
  return eintrag.woerter.every((w, i) => woerter[start + i] === w);
}

/**
 * Name für den Monitor: Kurzname, sonst Name mit gekürzten Listenwörtern.
 * @param name voller Teamname
 * @param shortName hinterlegter Kurzname (hat Vorrang, wenn nicht leer)
 */
export function monitorTeamName(name: string, shortName?: string | null): string {
  const kurz = shortName?.trim();
  if (kurz) { return kurz; }
  const woerter = name.trim().split(/\s+/).filter(w => w.length > 0);
  const ergebnis: string[] = [];
  let geaendert = false;
  for (let i = 0; i < woerter.length;) {
    const treffer = EINTRAEGE.find(e => folgeBei(woerter, i, e));
    if (treffer) {
      ergebnis.push(treffer.kuerzel);
      i += treffer.woerter.length;
      geaendert = true;
    } else {
      ergebnis.push(woerter[i]);
      i += 1;
    }
  }
  return geaendert ? ergebnis.join(' ') : name.trim();
}
