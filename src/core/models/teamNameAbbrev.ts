/**
 * Vereinskürzel am Monitor (MS1, @ZM-087, @ZM-148, @ZM-149; Quelle: Record Zuschauer und Monitor, „Teamnamen am Monitor“).
 *
 * Ein hinterlegter Kurzname hat Vorrang. Sonst werden übliche Vereinswörter nach fester, erweiterbarer Liste
 * gekürzt: nur ganze Wörter bzw. Wortfolgen (Grenze = Wortanfang/-ende, kein `\b` wegen Umlauten), Groß- und
 * Kleinschreibung wie in der Liste, die längste passende Folge zuerst. Der Zusatz „e. V.“ bzw. „e.V.“ (als ganzes
 * Wort) entfällt. Andere Kürzel (Anfangsbuchstaben) entstehen nie. Zuschauer-Seite, Spielplan und PDF nutzen diese
 * Funktion nicht (@ZM-148). Liegt die Liste in `core/models`, prüft der B-41-Scan sie nicht; sie ist ein Datenabgleich,
 * kein Anzeigetext (der Abgleich läuft gegen die deutschen Teamnamen aus den Turnierdaten).
 * Jede Erweiterung der Liste braucht eine Lern-Spur-Zeile im Record.
 */

/** Wortfolge → Kürzel, sortiert nach Länge der Wortfolge (längste zuerst), danach nach Zeichenlänge. */
export const VEREINS_KUERZEL: readonly (readonly [string, string])[] = [
  ['Verein für Bewegungsspiele', 'VfB'],
  ['Verein für Leibesübungen', 'VfL'],
  ['Verein für Rasenspiele', 'VfR'],
  ['Turn- und Sportverein', 'TSV'],
  ['Turn- und Spielvereinigung', 'TuS'],
  ['Turn und Sport', 'TuS'],
  ['Eisenbahner-Sportverein', 'ESV'],
  ['Eisenbahnersportverein', 'ESV'],
  ['Deutsche Jugendkraft', 'DJK'],
  ['Fußballsportverein', 'FSV'],
  ['Sportgemeinschaft', 'SG'],
  ['Spielvereinigung', 'SpVgg'],
  ['Fußballfreunde', 'FF'],
  ['Fußball-Club', 'FC'],
  ['Fußballclub', 'FC'],
  ['Sport-Club', 'SC'],
  ['Sportclub', 'SC'],
  ['Sportverein', 'SV'],
  ['Sportfreunde', 'SF'],
  ['Turngemeinde', 'TG'],
  ['Turnverein', 'TV'],
  ['Ballsportverein', 'BSV'],
  ['Ballspielverein', 'BV'],
];

/** Zusätze, die am Monitor entfallen (ganze Wörter; Wortfolgen als Teilliste). */
const ZUSATZ_ENTFAELLT: readonly (readonly string[])[] = [['e.', 'V.'], ['e.V.']];

interface Eintrag {
  woerter: readonly string[];
  kuerzel: string;
}

/** Längste Wortfolge zuerst („Turn- und Sportverein“ vor „Sportverein“), unabhängig von der Reihenfolge oben. */
const EINTRAEGE: readonly Eintrag[] = VEREINS_KUERZEL
  .map(([folge, kuerzel]) => ({ woerter: folge.split(' '), kuerzel }))
  .sort((a, b) => b.woerter.length - a.woerter.length
    || b.woerter.join(' ').length - a.woerter.join(' ').length);

function folgeBei(woerter: readonly string[], start: number, folge: readonly string[]): boolean {
  return folge.every((w, i) => woerter[start + i] === w);
}

/**
 * Name für den Monitor: Kurzname, sonst Name mit gekürzten Listenwörtern und ohne Zusatz „e. V.“.
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
    const zusatz = ZUSATZ_ENTFAELLT.find(f => folgeBei(woerter, i, f));
    if (zusatz) {
      i += zusatz.length;
      geaendert = true;
      continue;
    }
    const treffer = EINTRAEGE.find(e => folgeBei(woerter, i, e.woerter));
    if (treffer) {
      ergebnis.push(treffer.kuerzel);
      i += treffer.woerter.length;
      geaendert = true;
    } else {
      ergebnis.push(woerter[i]);
      i += 1;
    }
  }
  if (ergebnis.length === 0) { return name.trim(); }
  return geaendert ? ergebnis.join(' ') : name.trim();
}
