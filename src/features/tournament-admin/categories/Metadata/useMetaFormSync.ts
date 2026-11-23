/**
 * Formularstand der Stammdaten in der Verwaltung: angefangene Eingaben überstehen einen neuen Turnier-Stand
 * (@FU-134, @FU-105, @FU-089, @FU-108). Dieselbe Regel wie im Reiter Einstellungen (`SettingsTab`), gleicher Baustein
 * `metaFormRebase`; die privaten Notizen (`adminNotes`) werden wie eine weitere Angabe behandelt.
 *
 * Ein neues Turnier-Objekt kommt nach dem eigenen Speichern und wenn ein anderes Gerät etwas ändert. Das Formular zieht dann
 * nur die Angaben nach, die die Person NICHT angefasst hat. Überschneidet sich eine Eingabe mit der fremden Änderung
 * (@FU-108), beruht das Speichern weiter auf dem alten Stand (`saveBase`), der Server lehnt ab statt still zu überschreiben.
 */
import { useEffect, useRef, useState } from 'react';
import type { Tournament } from '../../../../types/tournament';
import { metaFormConflicts, metaFormOf, rebaseMetaForm, sameMetaForm, sameMetaValue, type MetaForm } from '../../../tournament-management/utils/metaFormRebase';
import type { TournamentMetaErrors } from '../../../../core/services/tournamentMetaValidation';

type VersionBase = Pick<Tournament, 'version' | 'serverVersion'>;
const versionOf = (t: Tournament): VersionBase => ({ version: t.version, serverVersion: t.serverVersion });
const notesOf = (t: Tournament): string => t.adminNotes ?? '';

export function useMetaFormSync(tournament: Tournament) {
  const [formData, setFormData] = useState<MetaForm>(() => metaFormOf(tournament));
  const [notes, setNotes] = useState(() => notesOf(tournament));
  const [metaErrors, setMetaErrors] = useState<TournamentMetaErrors>({});
  const sync = useRef({ id: tournament.id, base: metaFormOf(tournament), baseNotes: notesOf(tournament), version: versionOf(tournament), saveBase: null as VersionBase | null });
  const formDataRef = useRef(formData);
  formDataRef.current = formData;
  const notesRef = useRef(notes);
  notesRef.current = notes;

  useEffect(() => {
    const state = sync.current;
    const incoming = metaFormOf(tournament);
    const incomingNotes = notesOf(tournament);
    const { base, baseNotes, version } = state;
    const switched = state.id !== tournament.id;
    Object.assign(state, { id: tournament.id, base: incoming, baseNotes: incomingNotes, version: versionOf(tournament) });
    const current = formDataRef.current;
    const currentNotes = notesRef.current;
    const next = switched ? incoming : rebaseMetaForm(current, base, incoming);
    const nextNotes = switched || sameMetaValue(currentNotes, baseNotes) ? incomingNotes : currentNotes;
    if (switched || (sameMetaForm(next, incoming) && nextNotes === incomingNotes)) {
      state.saveBase = null;
      setMetaErrors({});
    } else if (state.saveBase === null) {
      const notesConflict = !sameMetaValue(currentNotes, baseNotes) && !sameMetaValue(incomingNotes, baseNotes) && !sameMetaValue(currentNotes, incomingNotes);
      if (notesConflict || metaFormConflicts(current, base, incoming)) { state.saveBase = version; }
    }
    setFormData(next);
    setNotes(nextNotes);
  }, [tournament]);

  /** Formular auf den aktuellen Stand setzen („Zurücksetzen“): verwirft Eingaben und die Konflikt-Basis. */
  const resetToTournament = () => {
    sync.current.saveBase = null;
    setFormData(metaFormOf(tournament));
    setNotes(notesOf(tournament));
    setMetaErrors({});
  };

  return { formData, setFormData, notes, setNotes, metaErrors, setMetaErrors, getSaveBase: (): VersionBase | null => sync.current.saveBase, resetToTournament };
}
