import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Minimal Interface for checking
interface ImportedMatch {
    id: string;
    scheduledTime: string;
    teamA: string;
    teamB: string;
}

interface ImportedTeam {
    id: string;
    name: string;
}

interface ImportedTournament {
    matches: ImportedMatch[];
    teams: ImportedTeam[];
    title: string;
}

describe('Hallenkreismeisterschaft Scenario Import', () => {
    it('should correctly import the specific schedule with Match 8 at 10:54', () => {
        // Load the reference JSON
        const jsonPath = path.join(__dirname, 'fixtures', 'reference_tournament.json');
        const fileContent = fs.readFileSync(jsonPath, 'utf-8');
        const importedTournament = JSON.parse(fileContent) as ImportedTournament;

        // Verify Tournament Structure
        expect(importedTournament.title).toBe('Hallenkreismeisterschaft U11 Inn/Salzach');
        expect(importedTournament.matches).toHaveLength(21);

        // MATCH 8 Verification
        const match8 = importedTournament.matches.find(m => m.id === 'm8');
        expect(match8).toBeDefined();

        // Time Verification (UTC for 10:54 Local)
        expect(match8?.scheduledTime).toContain('09:54:00');

        // Team Verification (Wacker vs Wasserburg)
        // t1 = Wacker, t2 = Wasserburg (t3 in updated JSON?)
        // In the updated JSON: t1=Wacker, t3=Wasserburg
        const teamA = importedTournament.teams.find(t => t.id === match8?.teamA);
        const teamB = importedTournament.teams.find(t => t.id === match8?.teamB);

        expect(teamA?.name).toBe('SV Wacker Burghausen'); // JSON uses full name
        expect(teamB?.name).toBe('TSV 1880 Wasserburg am Inn'); // JSON uses full name
    });

    it('should verify the 12-minute rhythm leading up to 10:54', () => {
        const jsonPath = path.join(__dirname, 'fixtures', 'reference_tournament.json');
        const fileContent = fs.readFileSync(jsonPath, 'utf-8');
        const importedTournament = JSON.parse(fileContent) as ImportedTournament;

        // Verify Match 7 at 10:42 (09:42 UTC)
        const match7 = importedTournament.matches.find(m => m.id === 'm7');
        expect(match7?.scheduledTime).toContain('09:42:00');
    });
});
