/**
 * Script zum Löschen aller Spielergebnisse
 * Kann in der Browser-Console ausgeführt werden
 */

// Hole alle Turniere aus localStorage
const stored = localStorage.getItem('tournaments');
if (!stored) {
  console.log('Keine Turniere gefunden');
} else {
  const tournaments = JSON.parse(stored);
  
  // Lösche alle Ergebnisse (scoreA, scoreB)
  tournaments.forEach(tournament => {
    tournament.matches = tournament.matches.map(match => ({
      ...match,
      scoreA: undefined,
      scoreB: undefined,
    }));
    tournament.updatedAt = new Date().toISOString();
  });
  
  // Speichere zurück
  localStorage.setItem('tournaments', JSON.stringify(tournaments));
  
  // Lösche auch alle LiveMatches
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('liveMatches-')) {
      localStorage.removeItem(key);
    }
  });
  
  console.log('Alle Ergebnisse wurden gelöscht!');
  console.log('Bitte Seite neu laden (F5)');
}
