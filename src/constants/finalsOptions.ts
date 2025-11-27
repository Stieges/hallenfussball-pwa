/**
 * Finals Options Generator
 *
 * Generiert sinnvolle und mögliche Finalrunden-Varianten basierend auf:
 * - T = Gesamtzahl Teams
 * - G = Anzahl Gruppen
 *
 * Unterscheidung:
 * - "recommended" = Sinnvoll (fair, wenig Freilose, gute Struktur)
 * - "possible" = Nur möglich (theoretisch machbar, aber organisatorisch ungünstig)
 */

import { FinalsPreset } from '../types/tournament';

export interface FinalsOption {
  preset: FinalsPreset;
  label: string;
  description: string;
  category: 'recommended' | 'possible';
  minGroups?: number; // Mindestanzahl Gruppen für diese Variante
  finalTeams: number; // Anzahl Teams in der Finalrunde
  explanation?: string; // Warum sinnvoll oder nur möglich
}

/**
 * Gibt alle Finalrunden-Optionen für eine gegebene Anzahl Gruppen zurück
 */
export function getFinalsOptions(numberOfGroups: number): FinalsOption[] {
  const options: FinalsOption[] = [];

  // KEINE FINALRUNDE
  options.push({
    preset: 'none',
    label: 'Keine Finalrunde',
    description: 'Nur Gruppenphase, Platzierung nach Tabelle',
    category: 'recommended',
    finalTeams: 0,
    explanation: 'Empfohlen bei sehr wenig Zeit oder reinen Turnierspieltagen',
  });

  // 2 GRUPPEN
  if (numberOfGroups === 2) {
    // Empfohlen
    options.push({
      preset: 'top-4',
      label: 'Top 4 (Halbfinale + Finale)',
      description: 'Kreuzspiele: 1A-2B, 1B-2A → Finale + Platz 3',
      category: 'recommended',
      finalTeams: 4,
      explanation: 'Standard bei 2 Gruppen - fair und übersichtlich',
    });

    options.push({
      preset: 'all-places',
      label: 'Alle Plätze ausspielen',
      description: 'Halbfinale + Platzierungen 3, 5, 7',
      category: 'recommended',
      finalTeams: 8,
      explanation: 'Jedes Team hat noch ein Finalspiel - hohe Beteiligung',
    });

    // Nur möglich
    options.push({
      preset: 'final-only',
      label: 'Nur Finale',
      description: 'Direktes Finale: 1A vs 1B',
      category: 'possible',
      finalTeams: 2,
      explanation: 'Zu wenig Finalspiele, zweite Plätze spielen nicht um Platz 3',
    });
  }

  // 3 GRUPPEN
  else if (numberOfGroups === 3) {
    // Empfohlen
    options.push({
      preset: 'top-4',
      label: 'Top 4 (Halbfinale + Finale)',
      description: 'Beste 4 Teams → Halbfinale → Finale + Platz 3',
      category: 'recommended',
      finalTeams: 4,
      explanation: 'Sinnvoll bei 3 Gruppen - bester Gruppenerster bekommt Freilos',
    });

    // Nur möglich
    options.push({
      preset: 'final-only',
      label: 'Nur Finale',
      description: 'Beste 2 Teams direkt im Finale',
      category: 'possible',
      finalTeams: 2,
      explanation: 'Zu wenig Finalspiele, unfair wegen Freilos-Problematik',
    });

    options.push({
      preset: 'all-places',
      label: 'Top 6 (alle Gruppenersten + -zweite)',
      description: '6er-Endrunde mit Zwischengruppen oder KO',
      category: 'possible',
      finalTeams: 6,
      explanation: 'Komplex - zwei 3er-Zwischengruppen nötig, viel Zeit erforderlich',
    });
  }

  // 4 GRUPPEN
  else if (numberOfGroups === 4) {
    // Empfohlen
    options.push({
      preset: 'top-8',
      label: 'Top 8 (mit Viertelfinale)',
      description: 'Top 2 pro Gruppe → Viertelfinale → Halbfinale → Finale',
      category: 'recommended',
      minGroups: 4,
      finalTeams: 8,
      explanation: 'Klassisch bei 4 Gruppen - perfekte Symmetrie',
    });

    options.push({
      preset: 'top-4',
      label: 'Top 4 (nur Gruppenerste)',
      description: 'Nur Gruppenerste → Halbfinale → Finale',
      category: 'recommended',
      finalTeams: 4,
      explanation: 'Kürzere Variante - gut bei wenig Zeit',
    });

    // Nur möglich
    options.push({
      preset: 'all-places',
      label: 'Alle Plätze (Top 16)',
      description: 'Alle Teams in Finalrunde - komplette Platzierungen',
      category: 'possible',
      finalTeams: 16,
      explanation: 'Sehr viele Spiele - nur bei ganztägigen Turnieren realistisch',
    });

    options.push({
      preset: 'final-only',
      label: 'Nur Finale',
      description: 'Beste 2 Gruppenerste direkt im Finale',
      category: 'possible',
      finalTeams: 2,
      explanation: 'Zu wenig Finalspiele für 4 Gruppen',
    });
  }

  // 5-7 GRUPPEN
  else if (numberOfGroups >= 5 && numberOfGroups < 8) {
    // Empfohlen
    options.push({
      preset: 'top-8',
      label: 'Top 8 (mit Viertelfinale)',
      description: 'Beste 8 Teams → Viertelfinale → Halbfinale → Finale',
      category: 'recommended',
      minGroups: 4,
      finalTeams: 8,
      explanation: 'Standard für große Turniere - bewährte Struktur',
    });

    options.push({
      preset: 'top-4',
      label: 'Top 4 (Halbfinale)',
      description: 'Beste 4 Teams → Halbfinale → Finale',
      category: 'recommended',
      finalTeams: 4,
      explanation: 'Kürzere Variante bei vielen Gruppen',
    });

    // Nur möglich
    options.push({
      preset: 'all-places',
      label: 'Alle Plätze',
      description: 'Maximale Anzahl Teams in Finalrunde',
      category: 'possible',
      finalTeams: numberOfGroups * 4,
      explanation: 'Nur bei sehr großen, mehrtägigen Turnieren sinnvoll',
    });

    options.push({
      preset: 'final-only',
      label: 'Nur Finale',
      description: 'Beste 2 Teams direkt im Finale',
      category: 'possible',
      finalTeams: 2,
      explanation: 'Zu wenig Finalspiele für viele Gruppen',
    });
  }

  // 8+ GRUPPEN
  else if (numberOfGroups >= 8) {
    // Empfohlen
    options.push({
      preset: 'top-16',
      label: 'Top 16 (mit Achtelfinale)',
      description: 'Beste 16 Teams → Achtelfinale → Viertelfinale → Halbfinale → Finale',
      category: 'recommended',
      minGroups: 8,
      finalTeams: 16,
      explanation: 'Klassisch bei 8+ Gruppen - perfekte Symmetrie für große Turniere',
    });

    options.push({
      preset: 'top-8',
      label: 'Top 8 (mit Viertelfinale)',
      description: 'Beste 8 Teams → Viertelfinale → Halbfinale → Finale',
      category: 'recommended',
      minGroups: 4,
      finalTeams: 8,
      explanation: 'Kürzere Variante - gut bei begrenzter Zeit',
    });

    options.push({
      preset: 'top-4',
      label: 'Top 4 (nur Halbfinale)',
      description: 'Beste 4 Teams → Halbfinale → Finale',
      category: 'recommended',
      finalTeams: 4,
      explanation: 'Sehr kurze Variante - nur die absolut besten Teams',
    });

    // Nur möglich
    options.push({
      preset: 'all-places',
      label: 'Alle Plätze',
      description: 'Maximale Anzahl Teams in Finalrunde',
      category: 'possible',
      finalTeams: numberOfGroups * 4,
      explanation: 'Nur bei mehrtägigen Großturnieren realistisch - sehr viele Spiele',
    });

    options.push({
      preset: 'final-only',
      label: 'Nur Finale',
      description: 'Beste 2 Teams direkt im Finale',
      category: 'possible',
      finalTeams: 2,
      explanation: 'Viel zu wenig Finalspiele für so viele Gruppen',
    });
  }

  return options;
}

/**
 * Gibt die empfohlene (default) Finalrunden-Option zurück
 */
export function getRecommendedFinalsPreset(numberOfGroups: number): FinalsPreset {
  if (numberOfGroups === 2) return 'top-4';
  if (numberOfGroups === 3) return 'top-4';
  if (numberOfGroups === 4) return 'top-8';
  if (numberOfGroups >= 5 && numberOfGroups < 8) return 'top-8';
  if (numberOfGroups >= 8) return 'top-16';
  return 'none';
}

/**
 * Prüft ob eine Finalrunden-Variante für die Gruppenanzahl empfohlen ist
 */
export function isRecommendedOption(preset: FinalsPreset, numberOfGroups: number): boolean {
  const options = getFinalsOptions(numberOfGroups);
  const option = options.find(opt => opt.preset === preset);
  return option?.category === 'recommended';
}
