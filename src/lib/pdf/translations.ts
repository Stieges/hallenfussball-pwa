/**
 * Feste deutsche Texte des Spielplan-PDFs. Wandern in B-28a2 nach `tournament:pdf.*` (i18next).
 */
export const TRANSLATIONS = {
  de: {
    // Meta box labels
    organizer: 'Veranstalter',
    hall: 'Halle',
    matchDuration: 'Spielzeit',
    mode: 'Modus',
    gameday: 'Spieltag',
    time: 'Zeit',
    break: 'Pause',

    // Section titles
    participants: 'Teilnehmer',
    groupStage: 'Gruppenphase',
    standings: 'Tabelle',
    finalRanking: 'Platzierung',

    // Table headers
    nr: 'Nr',
    timeHeader: 'Zeit',
    field: 'Feld',
    group: 'Gr',
    home: 'Heim',
    result: 'Ergebnis',
    away: 'Gast',
    referee: 'SR',

    // Standings table headers
    pos: 'Pl',
    team: 'Team',
    played: 'Sp',
    won: 'S',
    drawn: 'U',
    lost: 'N',
    goals: 'Tore',
    diff: 'Diff',
    points: 'Pkt',

    // Finals phases
    roundOf16: 'Achtelfinale',
    quarterfinal: 'Viertelfinale',
    semifinal: 'Halbfinale',
    final: 'Finalspiele',
    thirdPlace: 'Spiel um Platz 3',
    fifthSixth: 'Spiel um Platz 5',
    seventhEighth: 'Spiel um Platz 7',

    // Hints
    hintReferees: 'SR = Schiedsrichter (SR1, SR2, ...)',
    hintResults: 'Ergebnisse bitte nach Spielende eintragen',
  },
};

export type Language = keyof typeof TRANSLATIONS;
export type PdfTexts = (typeof TRANSLATIONS)['de'];
