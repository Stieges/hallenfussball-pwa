// Quick script to check localStorage tournaments
const tournaments = JSON.parse(localStorage.getItem('tournaments') || '[]');

console.log('=== TOURNAMENT LOCATION DATA ===\n');

tournaments.forEach((t, idx) => {
  console.log(`Tournament ${idx + 1}: ${t.title || 'Unnamed'}`);
  console.log(`  ID: ${t.id}`);
  console.log(`  Location type: ${typeof t.location}`);
  console.log(`  Location:`, JSON.stringify(t.location, null, 2));
  console.log('---');
});

// Find Bergader specifically
const bergader = tournaments.find(t => t.title?.includes('Bergader'));
if (bergader) {
  console.log('\n=== BERGADER TOURNAMENT ===');
  console.log(JSON.stringify(bergader.location, null, 2));
}
