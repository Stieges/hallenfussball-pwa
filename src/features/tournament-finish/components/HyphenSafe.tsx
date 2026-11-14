/**
 * Wörter mit Bindestrich („Rot-Weiß“, „Kleinstadt-Neudorf“) und Namen mit Schrägstrich („SG Taching/Tengling“) brechen nie mitten im
 * Wort um (Grenzwert `titel.wortbruch`, VISUAL-DESIGN § 2). Der Baustein liegt seit @ZM-207 in `components/ui/atoms/TeamName` und gilt
 * auf allen Seiten; diese Datei hält die Namen für den Abschluss-Bereich bereit.
 */
export { HyphenSafe, TeamName } from '../../../components/ui/atoms/TeamName';
