/**
 * Debug Script für Playoff-Auflösung
 *
 * Kopieren Sie diesen Code in die Browser-Konsole (F12 → Console),
 * während Sie auf der Turnier-Management-Seite sind.
 */

(function debugPlayoffResolution() {
  // 1. Hole alle Turniere aus localStorage
  const tournamentsRaw = localStorage.getItem('tournaments');
  if (!tournamentsRaw) {
    console.error('❌ Keine Turniere im localStorage gefunden');
    return;
  }

  const tournaments = JSON.parse(tournamentsRaw);
  console.log(`📋 Gefundene Turniere: ${tournaments.length}`);

  // 2. Zeige alle Turniere
  tournaments.forEach((t, i) => {
    console.log(`  ${i + 1}. "${t.title}" (ID: ${t.id})`);
  });

  // 3. Analysiere jedes Turnier
  tournaments.forEach(tournament => {
    console.log('\n' + '='.repeat(60));
    console.log(`🏆 Turnier: "${tournament.title}"`);
    console.log('='.repeat(60));

    // Teams
    console.log('\n👥 Teams:');
    tournament.teams?.forEach(team => {
      console.log(`  - ${team.name} (ID: ${team.id}, Gruppe: ${team.group || 'keine'})`);
    });

    // Gruppenspiele
    const groupMatches = (tournament.matches || []).filter(m => !m.isFinal && m.group);
    console.log(`\n📊 Gruppenspiele: ${groupMatches.length}`);

    const completedGroupMatches = groupMatches.filter(m => m.scoreA !== undefined && m.scoreB !== undefined);
    console.log(`  ✅ Abgeschlossen: ${completedGroupMatches.length}/${groupMatches.length}`);

    if (groupMatches.length > 0) {
      console.log('\n  Gruppenspiele Details:');
      groupMatches.forEach(m => {
        const status = (m.scoreA !== undefined && m.scoreB !== undefined) ? '✅' : '⏳';
        console.log(`    ${status} Runde ${m.round}: ${m.teamA} vs ${m.teamB} (Gruppe: ${m.group}) - ${m.scoreA ?? '-'}:${m.scoreB ?? '-'}`);
      });
    }

    // Playoff-Spiele
    const playoffMatches = (tournament.matches || []).filter(m => m.isFinal);
    console.log(`\n🏁 Playoff-Spiele: ${playoffMatches.length}`);

    if (playoffMatches.length > 0) {
      console.log('\n  Playoff-Spiele Details:');
      playoffMatches.forEach(m => {
        const teamAIsPlaceholder = isPlaceholder(m.teamA);
        const teamBIsPlaceholder = isPlaceholder(m.teamB);
        const status = teamAIsPlaceholder || teamBIsPlaceholder ? '⏳ NICHT AUFGELÖST' : '✅ AUFGELÖST';

        console.log(`    ${status}`);
        console.log(`      ID: ${m.id}`);
        console.log(`      Label: ${m.label || '-'}`);
        console.log(`      TeamA: ${m.teamA} ${teamAIsPlaceholder ? '(PLATZHALTER!)' : ''}`);
        console.log(`      TeamB: ${m.teamB} ${teamBIsPlaceholder ? '(PLATZHALTER!)' : ''}`);
        console.log(`      Ergebnis: ${m.scoreA ?? '-'}:${m.scoreB ?? '-'}`);
      });
    }

    // Prüfe Auflösungs-Voraussetzungen
    console.log('\n🔍 Auflösungs-Check:');

    const allGroupsComplete = groupMatches.length > 0 &&
      groupMatches.every(m => m.scoreA !== undefined && m.scoreB !== undefined);
    console.log(`  - Alle Gruppenspiele abgeschlossen: ${allGroupsComplete ? '✅ JA' : '❌ NEIN'}`);

    const needsResolution = playoffMatches.some(m => isPlaceholder(m.teamA) || isPlaceholder(m.teamB));
    console.log(`  - Playoffs brauchen Auflösung: ${needsResolution ? '✅ JA' : '❌ NEIN (schon aufgelöst)'}`);

    if (allGroupsComplete && needsResolution) {
      console.log('\n  ⚠️ PROBLEM: Gruppenphase ist abgeschlossen, aber Playoffs sind nicht aufgelöst!');

      // Zeige Gruppen-Standings
      console.log('\n  📈 Berechnete Standings:');
      const groups = [...new Set(tournament.teams?.map(t => t.group).filter(Boolean))];
      groups.forEach(group => {
        console.log(`\n    Gruppe ${group}:`);
        const teamsInGroup = tournament.teams?.filter(t => t.group === group) || [];
        teamsInGroup.forEach((team, i) => {
          console.log(`      ${i + 1}. ${team.name} (ID: ${team.id})`);
        });
      });
    }
  });

  function isPlaceholder(teamRef) {
    if (!teamRef) return true;
    return (
      teamRef === 'TBD' ||
      teamRef.includes('group-') ||
      teamRef.includes('-1st') ||
      teamRef.includes('-2nd') ||
      teamRef.includes('-3rd') ||
      teamRef.includes('-4th') ||
      teamRef.includes('bestSecond') ||
      teamRef.includes('Sieger') ||
      teamRef.includes('Verlierer') ||
      teamRef.includes('winner') ||
      teamRef.includes('loser')
    );
  }

  console.log('\n' + '='.repeat(60));
  console.log('📋 Debug abgeschlossen. Kopieren Sie die Ausgabe und teilen Sie sie.');
  console.log('='.repeat(60));
})();
