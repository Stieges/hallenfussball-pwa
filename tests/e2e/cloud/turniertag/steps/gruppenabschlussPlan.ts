/**
 * Vorbedingung von D8 (Gruppenabschluss): Ergebnisse der noch nicht angepfiffenen Gruppenspiele so wählen, dass der Abschluss OHNE Gleichstand
 * geht. Die Schritte D4 bis D7 und D1 (Hallen-Monitor) haben einige Spiele schon gespielt oder beendet; deren Stand bleibt, nur die übrigen
 * werden gewählt (kleine Suche über Reihenfolge, Sieger und Ergebnis).
 *
 * Bedingung je Gruppe: kein Teampaar ist in Punkten, Tordifferenz und Toren gleich – dann gibt es nach keiner Reihenfolge-Regel einen
 * Gleichstand („Gleichstand – Entscheidung nötig“ entfällt). Bevorzugt (erste Stufe) zusätzlich: Platz 1, 2 und 3 haben verschiedene Punkte
 * (Platz 1 und 2 stehen ohne jede Reihenfolge-Regel fest, `oben` ist gesetzt) und die spätere Korrektur aus D12 ändert daran nichts.
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
  /** Team-IDs auf Platz 1 und 2 je Gruppe, wenn sie allein aus den Punkten folgen (erste Stufe); sonst `null`. */
  oben: Record<string, [string, string]> | null;
}

/** Tore der Sieger der drei Torschützen-Spiele mit ihren Rückennummern (@ET-032). */
const TORSCHUETZEN: readonly { tore: number; nummer: number }[] = [{ tore: 5, nummer: 7 }, { tore: 4, nummer: 10 }, { tore: 3, nummer: 7 }];
/** Ergebnisse der übrigen offenen Spiele. */
const WEITERE: readonly [number, number][] = [[2, 0], [0, 2], [6, 0], [0, 6], [1, 0], [0, 1], [0, 0], [1, 1], [3, 1], [1, 3]];

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

/** Kein Teampaar gleich in Punkten, Tordifferenz und Toren. */
function ohneGleichstand(spiele: readonly FesterStand[], group: string): boolean {
  const schluessel = tabelle(spiele, group).map((z) => `${z.pts}|${z.gd}|${z.gf}`);
  return new Set(schluessel).size === schluessel.length;
}

/** Platz 1 und 2, wenn Platz 1, 2 und 3 verschiedene Punkte haben; sonst `null`. */
function obenNachPunkten(spiele: readonly FesterStand[], group: string): [string, string] | null {
  const t = tabelle(spiele, group);
  return t.length >= 3 && t[0].pts > t[1].pts && t[1].pts > t[2].pts ? [t[0].team, t[1].team] : null;
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

function* kandidaten(offen: readonly PlanSpiel[]): Generator<GeplantesErgebnis[]> {
  const n = TORSCHUETZEN.length;
  for (const reihe of permutationen(offen)) {
    for (let seiten = 0; seiten < 2 ** n; seiten++) {
      const vorn: GeplantesErgebnis[] = reihe.slice(0, n).map((s, i) => {
        const { tore, nummer } = TORSCHUETZEN[i];
        const aGewinnt = ((seiten >> i) & 1) === 0;
        return { ...s, goalsA: aGewinnt ? tore : 0, goalsB: aGewinnt ? 0 : tore, nummer };
      });
      const sieger = vorn.map((e) => (e.goalsA > e.goalsB ? e.teamA : e.teamB));
      if (new Set(sieger).size !== sieger.length) {
        continue;
      }
      const rest = reihe.slice(n);
      for (let k = 0; k < WEITERE.length ** rest.length; k++) {
        yield [...vorn, ...rest.map((s, i) => {
          const [goalsA, goalsB] = WEITERE[Math.floor(k / WEITERE.length ** i) % WEITERE.length];
          return { ...s, goalsA, goalsB };
        })];
      }
    }
  }
}

/**
 * @param fest     schon entschiedene Spiele (Stand aus der Datenbank)
 * @param offen    noch nicht angepfiffene Spiele (mindestens drei, für die Torschützen)
 * @param korrektur Spiel und Stand der späteren Korrektur (D12); erste Stufe: sie ändert Platz 1 und 2 nicht
 */
export function planeGruppenErgebnisse(fest: readonly FesterStand[], offen: readonly PlanSpiel[], korrektur?: { id: string; goalsA: number; goalsB: number }): GruppenPlan | null {
  if (offen.length < TORSCHUETZEN.length) {
    return null;
  }
  const gruppen = [...new Set([...fest, ...offen].map((s) => s.group))].sort();
  let ersatz: GeplantesErgebnis[] | null = null;
  for (const ergebnisse of kandidaten(offen)) {
    const heute = [...fest, ...ergebnisse];
    if (!gruppen.every((g) => ohneGleichstand(heute, g))) {
      continue;
    }
    ersatz ??= ergebnisse;
    const spaeter = korrektur ? heute.map((s) => (s.id === korrektur.id ? { ...s, goalsA: korrektur.goalsA, goalsB: korrektur.goalsB } : s)) : heute;
    const oben: Record<string, [string, string]> = {};
    for (const g of gruppen) {
      const jetzt = obenNachPunkten(heute, g);
      if (jetzt !== null && jetzt.join() === obenNachPunkten(spaeter, g)?.join()) {
        oben[g] = jetzt;
      }
    }
    if (Object.keys(oben).length === gruppen.length) {
      return { ergebnisse, oben };
    }
  }
  return ersatz === null ? null : { ergebnisse: ersatz, oben: null };
}
