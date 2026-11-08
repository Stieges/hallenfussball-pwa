/**
 * Gruppentabellen und Strafstoßschießen um Platz 1 (@DR-005, @DR-009, @DR-018, @DR-035, @DR-036). Rein, fertig vermessen: Flächen,
 * Raster und Texte stehen mit Position im Modell, die Zeichenschicht rechnet nichts.
 *
 * Tabelle: Spaltenkopf (Kurzformen, @OB-075) in heller Fläche, darunter je Team eine Zeile von `max(rowMin, Namenszeilen × Zeilenabstand
 * + 2 × Polster)` Höhe, in allen Zeilen gleich. Beide Fassungen: Kästchen mit grauem Raster (@DR-035, auch mit Ergebnissen, Fixrunde 2
 * zu PR #444); die Fassung ohne Ergebnisse trägt zusätzlich einen Doppelpunkt in „Tore“.
 */
import { getGroupShortCode } from '../../../utils/displayNames';
import type { Standing, Team } from '../../../types/tournament';
import { printColumns, printFont, printType, printUnit } from '../../../design-tokens/print';
import { printFinals, printGroupMark, printMatchRow, printMatchTable, printStandings, printTail, printWriteLine } from '../../../design-tokens/print-sheet';
import type { RankEntry } from '../placement';
import { printEndTable } from '../../../design-tokens/print-endstand';
import type { ModelEnv } from './env';
import { endstandColumnStyles, tiebreakCriteria } from './endstandTable';
import { wrapName } from './nameLines';
import type { Placeable } from './sectionFlow';
import { advanceMm, ascent, centeredBaseline, descent, run } from './text';
import type { Fill, GroupMark, Segment, StandingsTableBlock, TextRun, WriteLine } from './types';

const COLUMN_KEYS = ['pos', 'team', 'played', 'won', 'drawn', 'lost', 'goals', 'diff', 'points'] as const;
type Key = (typeof COLUMN_KEYS)[number];

/** Spalten: feste Breiten aus `printColumns.standings`, „Team“ bekommt den Rest. */
function columnsOf(left: number, width: number): Array<{ key: Key; x: number; w: number }> {
  const fixed = printColumns.standings;
  const team = width - Object.values(fixed).reduce((sum, w) => sum + w, 0);
  let x = left;
  return COLUMN_KEYS.map(key => {
    const w = key === 'team' ? team : fixed[key];
    const col = { key, x, w };
    x += w;
    return col;
  });
}

/**
 * Werte einer Zeile (@DR-035): sobald das Turnier ein erstes Ergebnis hat (`filled`), steht in jedem Kästchen eine Zahl, auch 0 und
 * auch bei einem Team ohne Spiel; vorher bleiben alle Kästchen leer zum Selbstausfüllen.
 */
function valuesOf(standing: Standing, place: string, filled: boolean): string[] {
  if (!filled) {
    return COLUMN_KEYS.map(() => '');
  }
  const diff = standing.goalDifference;
  return [
    place, '', String(standing.played), String(standing.won), String(standing.drawn), String(standing.lost),
    `${standing.goalsFor}:${standing.goalsAgainst}`, diff > 0 ? `+${diff}` : String(diff), String(standing.points),
  ];
}

interface TableRow { name: string; cells: string[] }

/** Gruppen der Tabellen: eine je Gruppe, sonst (Jeder gegen jeden, Abschlusstabelle) eine über alle Teams (Kennung ''). */
function groupsOf(teams: readonly Team[], single: boolean): string[] {
  const groups = [...new Set(teams.map(team => team.group).filter((g): g is string => g !== undefined && g !== ''))].sort();
  return single || groups.length === 0 ? [''] : groups;
}

/** Eine Tabelle als Baustein: Höhe vorab, Block ab `top`. */
function tablePlaceable(env: ModelEnv, caption: string, mark: Pick<GroupMark, 'shape'> & { code: string } | undefined, rows: TableRow[], blank: boolean, emphasis = false): Placeable {
  const { geo, t } = env.source;
  const cols = columnsOf(geo.left, geo.contentWidth);
  const col = (key: Key): { x: number; w: number } => cols.find(c => c.key === key) ?? { x: 0, w: 0 };
  const team = col('team');
  const markGap = mark ? printGroupMark.size + printStandings.nameInset : 0;
  const nameWidth = team.w - 2 * printStandings.nameInset;
  const adv = advanceMm(printType.body, printMatchRow.lineHeight);
  const names = rows.map(row => wrapName(row.name, nameWidth, printType.body, env.measure));
  const rowH = Math.max(printStandings.rowMin, Math.max(1, ...names.map(lines => lines.length)) * adv + 2 * printStandings.rowPad);
  const height = printStandings.headHeight + rows.length * rowH;
  // Endstand (@DR-051): Platz und Punkte am größten, übrige Zahlen nach der Wertung abgestuft, Spalte „Punkte“ hinterlegt
  const styles = emphasis ? endstandColumnStyles(env.rules.placementLogic) : undefined;
  const labels: Record<Key, string> = { pos: t.pos, team: caption, played: t.played, won: t.won, drawn: t.drawn, lost: t.lost, goals: t.goals, diff: t.diff, points: t.points };
  return {
    height,
    build: (top): [StandingsTableBlock] => {
      const headMid = top + printStandings.headHeight / 2;
      const runs: TextRun[] = cols.map(c => c.key === 'team'
        ? run(labels.team, c.x + printStandings.nameInset + markGap, centeredBaseline(headMid, printMatchTable.headPt), printMatchTable.headPt, 'bold')
        : run(labels[c.key], c.x + c.w / 2, centeredBaseline(headMid, printMatchTable.headPt), printMatchTable.headPt, 'bold', 'center'));
      const fills: Fill[] = [{ kind: 'tableHead', x: geo.left, y: top, w: geo.contentWidth, h: printStandings.headHeight }];
      const grid: Segment[] = [];
      let y = top + printStandings.headHeight;
      rows.forEach((row, index) => {
        const mid = y + rowH / 2;
        cols.forEach((c, k) => {
          if (c.key === 'team') {
            names[index].forEach((line, i) => runs.push(run(line, c.x + printStandings.nameInset, centeredBaseline(mid + (i - (names[index].length - 1) / 2) * adv, printType.body), printType.body, 'normal')));
          } else if (c.key === 'goals' && blank) {
            runs.push(run(':', c.x + c.w / 2, mid + printFont.colonMidEm * printStandings.colonPt * printUnit.mmPerPt, printStandings.colonPt, 'bold', 'center'));
          } else if (row.cells[k] !== '') {
            const style = styles?.[c.key];
            const size = style?.pt ?? printType.body;
            runs.push(run(row.cells[k], c.x + c.w / 2, centeredBaseline(mid, size), size, style?.weight ?? (c.key === 'goals' ? 'bold' : 'normal'), 'center'));
          }
        });
        if (styles) {
          fills.push({ kind: 'column', x: col('points').x, y, w: col('points').w, h: rowH });
        }
        y += rowH;
      });
      // Graues Raster in beiden Fassungen, vor dem ersten Ergebnis wie danach (@DR-035); die Zeilen trennt das Raster, ohne Zebra
      const rights = [...cols.map(c => c.x), geo.left + geo.contentWidth];
      const ys = [top, top + printStandings.headHeight, ...rows.map((_, i) => top + printStandings.headHeight + (i + 1) * rowH)];
      ys.forEach(at => grid.push({ x1: geo.left, y1: at, x2: geo.left + geo.contentWidth, y2: at }));
      rights.forEach(at => grid.push({ x1: at, y1: top, x2: at, y2: top + height }));
      const block: StandingsTableBlock = { kind: 'standingsTable', top, height, fills, grid, runs };
      if (mark) {
        const size = printGroupMark.size;
        const x = team.x + printStandings.nameInset;
        block.group = {
          text: run(mark.code, x + size / 2, centeredBaseline(headMid, printType.nr), printType.nr, 'bold', 'center'),
          frame: { x, y: headMid - size / 2, w: size, h: size },
          shape: mark.shape,
        };
        runs.unshift(block.group.text);
      }
      return [block];
    },
  };
}

/**
 * Tabellen aller Gruppen. `finalOrder` gesetzt = Abschlusstabelle nach dem Abschluss (@DR-009): eine Tabelle über alle Teams in
 * der Reihenfolge des gespeicherten Endstands, die Spalte „Pl“ trägt den gespeicherten Platz.
 */
export function tableParts(env: ModelEnv, finalOrder: RankEntry[] | undefined): Placeable[] {
  const { input, t } = env.source;
  const { schedule, edition } = input;
  const blank = edition === 'blank';
  const groups = groupsOf(schedule.teams, finalOrder !== undefined);
  const all = input.state.standings ?? schedule.initialStandings;
  // Das erste Ergebnis des Turniers (nicht nur der Gruppe) füllt alle Tabellen (@DR-035)
  const filled = finalOrder !== undefined || all.some(standing => standing.played > 0);
  const placeOf = (id: string): number => finalOrder?.find(entry => entry.team.id === id)?.place ?? Number.MAX_SAFE_INTEGER;
  return groups.map((group, index) => {
    const teams = group === '' ? schedule.teams : schedule.teams.filter(team => team.group === group);
    const multiple = groups.length > 1;
    const caption = finalOrder ? t.finalTable : multiple ? t.groupLabel(group, groupDisplayName(env, group)) : t.team;
    const mark = multiple ? { code: getGroupShortCode(group, schedule.tournament), shape: index % 2 === 0 ? ('square' as const) : ('circle' as const) } : undefined;
    if (blank) {
      return tablePlaceable(env, caption, mark, teams.map(team => ({ name: team.name, cells: COLUMN_KEYS.map(() => '') })), true);
    }
    const inGroup = all.filter(standing => teams.some(team => team.id === standing.team.id));
    const ordered = finalOrder ? [...inGroup].sort((a, b) => placeOf(a.team.id) - placeOf(b.team.id)) : inGroup;
    const rows = ordered.map((standing, i) => ({
      name: standing.team.name,
      cells: valuesOf(standing, String(finalOrder ? placeOf(standing.team.id) : standing.place ?? i + 1), filled),
    }));
    return tablePlaceable(env, caption, mark, rows, false, edition === 'final');
  });
}

/**
 * Zeile „Wertung: Punkte · Tordifferenz · Tore“ unter den Tabellen des Endstands (@DR-051), in der Reihenfolge der Regel des Turniers.
 * Jede Zeile des Umbruchs ist ein Textstück; die Höhe zählt nur die Schrift, den Abstand zur Tabelle setzt die Seitenplanung.
 */
export function wertungHintPlaceable(env: ModelEnv): Placeable {
  const { geo, t } = env.source;
  const text = t.tiebreakHint(tiebreakCriteria(env.rules.placementLogic, t.rules.criterion).join(t.rules.join));
  const lines = wrapName(text, geo.contentWidth, printEndTable.hintPt, env.measure);
  const adv = advanceMm(printEndTable.hintPt, printEndTable.hintLineHeight);
  const height = lines.length * adv;
  return {
    height,
    build: top => [{ kind: 'text', top, height, runs: lines.map((line, i) => run(line, geo.left, centeredBaseline(top + (i + 1 / 2) * adv, printEndTable.hintPt), printEndTable.hintPt, 'normal')) }],
  };
}

function groupDisplayName(env: ModelEnv, group: string): string {
  return env.sideCtx.groupName?.(group) ?? `Gruppe ${group}`;
}

/**
 * Strafstoßschießen um Platz 1 (@DR-036): Überschrift, darunter eine Zeile mit je einer Linie für beide Teams und je einer für
 * ihre Treffer, ohne Kasten; „Team“, „Treffer“, „Team“ klein unter den Linien.
 */
export function shootoutPlaceable(env: ModelEnv): Placeable {
  const { geo, t } = env.source;
  const lineAbove = printTail.titleBand + printWriteLine.minWriteSpace + printTail.shootoutGap;
  const smallBelow = printFinals.textGap + ascent(printFinals.smallPt) + descent(printFinals.smallPt) + printFinals.bottomPad;
  return {
    height: lineAbove + smallBelow,
    build: top => {
      const y = top + lineAbove;
      const pair = 2 * printWriteLine.shootoutHits + printTail.shootoutColon;
      const team = (geo.contentWidth - pair - 2 * printTail.shootoutGap) / 2;
      const hitsX = geo.left + team + printTail.shootoutGap;
      const rightX = hitsX + pair + printTail.shootoutGap;
      const label = (text: string, x: number): TextRun => run(text, x, y + printFinals.textGap + ascent(printFinals.smallPt), printFinals.smallPt, 'normal', 'center');
      const lines: WriteLine[] = [
        { kind: 'shootout', x1: geo.left, x2: geo.left + team, y },
        { kind: 'shootout', x1: hitsX, x2: hitsX + printWriteLine.shootoutHits, y },
        { kind: 'shootout', x1: hitsX + printWriteLine.shootoutHits + printTail.shootoutColon, x2: hitsX + pair, y },
        { kind: 'shootout', x1: rightX, x2: rightX + team, y },
      ];
      const runs = [
        run(t.shootoutLine.title, geo.left, top + ascent(printTail.titlePt), printTail.titlePt, 'bold'),
        run(':', hitsX + pair / 2, y - printMatchTable.colonLift, printWriteLine.colonPt, 'bold', 'center'),
        label(t.team, geo.left + team / 2),
        label(t.shootoutLine.hits, hitsX + pair / 2),
        label(t.team, rightX + team / 2),
      ];
      return [{ kind: 'shootout', top, height: lineAbove + smallBelow, runs, lines }];
    },
  };
}

