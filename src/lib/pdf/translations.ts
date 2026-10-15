/**
 * Texte des Spielplan-PDFs (B-28a2). Alle Wörter kommen aus `tournament:pdf.*` (DE und EN).
 *
 * Der Übersetzer ist austauschbar: die App reicht i18next durch, Tests reichen die echte Ressource durch
 * (`__tests__/pdfText.ts`). Datum und Uhrzeit laufen über `Intl.DateTimeFormat(locale)`.
 */

export type PdfLocale = 'de' | 'en';

/** Übersetzt einen Schlüssel unter `tournament` (z. B. `pdf.nr`) mit optionalen Werten. */
export type PdfTranslator = (key: string, values?: Record<string, string | number>) => string;

export interface PdfTexts {
  organizer: string;
  hall: string;
  matchDuration: string;
  mode: string;
  gameday: string;
  time: string;
  participants: string;
  groupStage: string;
  finalRanking: string;
  nr: string;
  timeHeader: string;
  field: string;
  group: string;
  home: string;
  result: string;
  away: string;
  referee: string;
  pos: string;
  team: string;
  played: string;
  won: string;
  drawn: string;
  lost: string;
  goals: string;
  diff: string;
  points: string;
  thirdPlace: string;
  fifthSixth: string;
  seventhEighth: string;
  hintResults: string;
  /** Seitenzahl „Seite x von y“ (Fußzeile). */
  pageOf: (page: number, total: number) => string;
  noDate: string;
  modeGroupsAndFinals: string;
  modeRoundRobin: string;
  standingsOfGroup: (group: string) => string;
  durationMinutes: (minutes: number) => string;
  refereeNumber: (number: number | string) => string;
  tournamentTitle: string;
  ageClass: string;
  unrenderableName: (name: string) => string;
  /** Feldname mit Text, der nicht darstellbar ist (z. B. Turniername, Halle, Veranstalter). */
  unrenderableField: (field: string, text: string) => string;
  /** Titel der Finalphase. Unbekannte Phasen bleiben beim Namen aus dem Plan. */
  phaseTitle: (name: string, fallback: string) => string;
  /** Gruppenname. Der generische Name „Gruppe X“ wird übersetzt, ein eigener Name bleibt. */
  groupLabel: (id: string, displayName: string) => string;
  /** Spieltag aus `JJJJ-MM-TT` in der Sprache des Dokuments; anderes Format bleibt unverändert. */
  formatDate: (isoDate: string) => string;
  /** Uhrzeit `HH:mm` in der Sprache des Dokuments. */
  formatClock: (date: Date) => string;
}

const FINAL_PHASES = ['roundOf16', 'quarterfinal', 'semifinal', 'final'] as const;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Sprache des Dokuments: Englisch, sonst Deutsch (Vorgabe). */
export function resolvePdfLocale(language: string | undefined): PdfLocale {
  return language?.startsWith('en') ? 'en' : 'de';
}

/** Baut alle Texte über den Übersetzer. Schlüssel liegen unter `pdf.*`. */
export function buildPdfTexts(translate: PdfTranslator, locale: PdfLocale): PdfTexts {
  const s = (key: string): string => translate(`pdf.${key}`);
  const clock = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const day = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });

  return {
    organizer: s('organizer'),
    hall: s('hall'),
    matchDuration: s('matchDuration'),
    mode: s('mode'),
    gameday: s('gameday'),
    time: s('time'),
    participants: s('participants'),
    groupStage: s('groupStage'),
    finalRanking: s('finalRanking'),
    nr: s('nr'),
    timeHeader: s('timeHeader'),
    field: s('field'),
    group: s('group'),
    home: s('home'),
    result: s('result'),
    away: s('away'),
    referee: s('referee'),
    pos: s('pos'),
    team: s('team'),
    played: s('played'),
    won: s('won'),
    drawn: s('drawn'),
    lost: s('lost'),
    goals: s('goals'),
    diff: s('diff'),
    points: s('points'),
    thirdPlace: s('thirdPlace'),
    fifthSixth: s('fifthSixth'),
    seventhEighth: s('seventhEighth'),
    hintResults: s('hintResults'),
    pageOf: (page, total) => translate('pdf.pageOf', { page, total }),
    noDate: s('noDate'),
    modeGroupsAndFinals: s('modeGroupsAndFinals'),
    modeRoundRobin: s('modeRoundRobin'),
    standingsOfGroup: group => translate('pdf.standingsOfGroup', { group }),
    durationMinutes: minutes => translate('pdf.durationMinutes', { minutes }),
    refereeNumber: number => translate('pdf.refereeNumber', { number }),
    tournamentTitle: s('tournamentTitle'),
    ageClass: s('ageClass'),
    unrenderableName: name => translate('pdf.unrenderableName', { name }),
    unrenderableField: (field, text) => translate('pdf.unrenderableField', { field, text }),
    phaseTitle: (name, fallback) =>
      (FINAL_PHASES as readonly string[]).includes(name) ? s(`phase.${name}`) : fallback,
    groupLabel: (id, displayName) =>
      displayName === `Gruppe ${id}` ? translate('pdf.groupName', { id }) : displayName,
    formatDate: isoDate => {
      const match = ISO_DATE.exec(isoDate);
      if (!match) {
        return isoDate;
      }
      return day.format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))));
    },
    formatClock: date => clock.format(date),
  };
}
