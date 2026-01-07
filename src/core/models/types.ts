/**
 * Core Domain Models
 * Re-exporting types from the types folder to establish a clean Domain Boundary.
 * In the future, we might move the actual definitions here.
 */

import { Tournament, Match, Team } from '../../types/tournament';

export type { Tournament, Match, Team };

// Helper Types for partial updates
export type MatchUpdate = Partial<Match> & { id: string };
export type TeamUpdate = Partial<Team> & { id: string };
