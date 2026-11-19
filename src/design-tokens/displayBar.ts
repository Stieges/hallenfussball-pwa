/**
 * Farben des Zeitbalkens am Hallenmonitor je Thema (@ZM-215): gelten für das Profil „Halle (sehr fern)“ und die übrigen Live-Sichten des Monitors.
 * Die Füllung ist der kräftige Teil und läuft mit der Restzeit herunter, die abgelaufene Strecke ist die blassere Bahn.
 * Dunkel (das einzige Thema am Monitor im MVP, helles Design @ZM-173): Füllung heller als die Bahn; hell: Füllung dunkler als die Bahn.
 * Füllung gegen Bahn jeweils mindestens 3 : 1, Bahn gegen Hintergrund an der Stelle des Balkens (Verlauf 64–72 % der Höhe) dunkel mindestens 2,9 : 1
 * (gemessen 2,96 bis 2,99), hell mindestens 2,0 : 1 (Test `displayHall.zm213.test.ts`).
 * Grün läuft, grau angehalten, violett in der Schlussphase (dunkel: dasselbe Violett wie die Uhr), gedämpft in der Pause. Aus der Palette; neu sind nur
 * `dark.track` (#586880: Violett `purple.300` hat gegen `neutral.500` nur 2,58 : 1, gegen #586880 3,07 : 1) und `light.violett` (#5B21B6: dunkles
 * Violett, `purple.600` hat gegen die Bahn nur 2,4 : 1).
 */
import { palette } from './colors/palette';

export const barColors = {
  dark: { track: '#586880', gruen: palette.green[400], grau: palette.neutral[50], violett: palette.purple[300], gedaempft: palette.neutral[300] },
  light: { track: palette.neutral[400], gruen: palette.green[800], grau: palette.neutral[700], violett: '#5B21B6', gedaempft: palette.blue[900] },
} as const;

export const displayBar = { colors: barColors } as const;
