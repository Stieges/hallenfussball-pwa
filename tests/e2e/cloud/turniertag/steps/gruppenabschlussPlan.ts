/**
 * Vorbedingung von D8 (Gruppenabschluss): Ergebnisse der noch nicht angepfiffenen Gruppenspiele so wählen, dass der Abschluss OHNE Gleichstand
 * geht und die Halbfinal-Besetzung allein aus den Punkten folgt. Die Schritte D4 bis D7 und D1 (Hallen-Monitor) haben einige Spiele schon
 * gespielt oder beendet; deren Stand bleibt, nur die übrigen werden gewählt (kleine Suche über Reihenfolge und Sieger).
 *
 * Bedingungen je Gruppe, mit dem heutigen Stand UND mit der späteren Korrektur aus D12 (Gruppenspiel 1 auf 4:0):
 *  - Platz 1, 2 und 3 haben verschiedene Punkte (Platz 1 und 2 stehen ohne Tiebreak fest),
 *  - kein Teampaar ist in Punkten, Tordifferenz und Toren gleich (kein „Gleichstand – Entscheidung nötig“),
 *  - Platz 1 und 2 sind in beiden Fällen dieselben Teams.
 * Dazu Tore mit Rückennummer für den Endstand (D10b, @ET-032): die Sieger der ersten drei gewählten Spiele schießen #7 (5 Tore), #10 (4 Tore)
 * und #7 (3 Tore) – drei verschiedene Teams, also zwei getrennte Einträge „#7“.
 * Rein, ohne Playwright: die Schritte rufen `planeGruppenErgebnisse` mit den Spielen aus der Datenbank auf.
 */

export interface PlanSpiel {
  id: string;
  group: string;
  teamA: string;
  teamB: string;
}

/** Stand eines schon gespielten (oder vorab beendeten) Spiels. */
export interface FesterStand extends PlanSpiel {
  goalsA: number;
  goalsB: number;
}

export interface GeplantesErgebnis extends FesterStand {
  /** Rückennummer der Tore des Siegers (nur die drei Torschützen-Spiele). */
  nummer?: number;
}

export interface GruppenPlan {
  ergebnisse: GeplantesErgebnis[];
  /** Team-IDs auf Platz 1 und 2 je Gruppe. */
  oben: Record<string, [string, string]>;
}

/** Tore der Sieger in Reihenfolge; die ersten drei tragen die Rückennummern 7, 10, 7 (@ET-032). */
const SIEGERTORE = [5, 4, 3, 2, 6, 1, 7, 8];
const NUMMERN: readonly (number | undefined)[] = [7, 10, 7];

interface Zeile { team: string; pts: number; gd: number; gf: number }

function tabelle(spiele: readonly FesterStand[], group: string): Zeile[] {
  const zeilen = new Map<string, Zeile>();
  const zeile = (team: string): Zeile => {
    const z = zeilen.get(team) ?? { team, pts: 0, gd: 0, gf: 0 };
    zeilen.set(team, z);
    return z;
  };
  for (const s of spiele.filter((x) => x.group === group)) {
    const a = zeile(s.teamA);
    const b = zeile(s.teamB);
    a.gf += s.goalsA; b.gf += s.goalsB;
    a.gd += s.goalsA - s.goalsB; b.gd += s.goalsB - s.goalsA;
    a.pts += s.goalsA > s.goalsB ? 3 : s.goalsA === s.goalsB ? 1 : 0;
    b.pts += s.goalsB > s.goalsA ? 3 : s.goalsA === s.goalsB ? 1 : 0;
  }
  return [...zeilen.values()].sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf);
}

/** Platz 1 und 2 der Gruppe, wenn die Bedingungen erfüllt sind; sonst `null`. */
function obenEindeutig(spiele: readonly FesterStand[], group: string): [string, string] | null {
  const t = tabelle(spiele, group);
  if (t.length < 3 || !(t[0].pts > t[1].pts && t[1].pts > t[2].pts)) {
    return null;
  }
  const schluessel = t.map((z) => `${z.pts}|${z.gd}|${z.gf}`);
  return new Set(schluessel).size === schluessel.length ? [t[0].team, t[1].team] : null;
}

function* permutationen<T>(liste: readonly T[]): Generator<T[]> {
  if (liste.length <= 1) {
    yield [...liste];
    return;
  }
  for (let i = 0; i < liste.length; i++) {
    for (const rest of permutationen([...liste.slice(0, i), ...liste.slice(i + 1)])) {
      yield [liste[i], ...rest];
    }
  }
}

/**
 * @param fest     schon entschiedene Spiele (Stand aus der Datenbank)
 * @param offen    noch nicht angepfiffene Spiele (mindestens drei, für die Torschützen)
 * @param korrektur Spiel und Stand der späteren Korrektur (D12), die die Besetzung nicht ändern darf
 */
export function planeGruppenErgebnisse(fest: readonly FesterStand[], offen: readonly PlanSpiel[], korrektur?: { id: string; goalsA: number; goalsB: number }): GruppenPlan | null {
  if (offen.length < NUMMERN.length) {
    return null;
  }
  const gruppen = [...new Set([...fest, ...offen].map((s) => s.group))].sort();
  for (const reihe of permutationen(offen)) {
    for (let seiten = 0; seiten < 2 ** reihe.length; seiten++) {
      const ergebnisse: GeplantesErgebnis[] = reihe.map((s, i) => {
        const aGewinnt = ((seiten >> i) & 1) === 0;
        const tore = SIEGERTORE[i % SIEGERTORE.length];
        const nummer = NUMMERN[i];
        return { ...s, goalsA: aGewinnt ? tore : 0, goalsB: aGewinnt ? 0 : tore, ...(nummer === undefined ? {} : { nummer }) };
      });
      const sieger = ergebnisse.slice(0, NUMMERN.length).map((e) => (e.goalsA > e.goalsB ? e.teamA : e.teamB));
      if (new Set(sieger).size !== sieger.length) {
        continue;
      }
      const heute = [...fest, ...ergebnisse];
      const spaeter = korrektur ? heute.map((s) => (s.id === korrektur.id ? { ...s, goalsA: korrektur.goalsA, goalsB: korrektur.goalsB } : s)) : heute;
      const oben: Record<string, [string, string]> = {};
      let passt = true;
      for (const g of gruppen) {
        const jetzt = obenEindeutig(heute, g);
        const dann = obenEindeutig(spaeter, g);
        if (jetzt?.join() !== dann?.join() || jetzt === null) {
          passt = false;
          break;
        }
        oben[g] = jetzt;
      }
      if (passt) {
        return { ergebnisse, oben };
      }
    }
  }
  return null;
}
