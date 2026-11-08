/**
 * Ist die Restzeit der Monitor-Uhr sicher? Die Monitor-Seite setzt `false`, solange die Verbindung eingefroren ist
 * (30 Sekunden ohne Antwort, @ME-030, @ZM-085): die Uhr zählt weiter, ist aber grau und als „unsicher“ gekennzeichnet.
 * Ohne Bereitsteller gilt „sicher“ (Vorschau, Tests).
 */
import { createContext } from 'react';

export const UhrSicherheitContext = createContext<boolean>(true);
