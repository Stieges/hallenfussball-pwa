import { TeamScheduleState } from './fairScheduler';

/**
 * Stateful helper that maintains incremental fairness metrics.
 * Caches average rest per team and global variance for O(1) lookups.
 *
 * Performance: Reduces complexity from O(n³) to O(n²) by caching
 * calculated metrics and updating incrementally.
 */
export class FairnessCalculator {
  private teamStates!: Map<string, TeamScheduleState>;
  private readonly avgRestByTeam = new Map<string, number>();
  private globalMinAvg = Infinity;
  private globalMaxAvg = -Infinity;
  private readonly projectionCache = new Map<string, number>();

  constructor() {
    // Constructor kept for potential future parameters
  }

  /**
   * Bind to the mutable teamStates map (call once at start)
   */
  bindTeamStates(teamStates: Map<string, TeamScheduleState>): void {
    this.teamStates = teamStates;
    this.rebuildAllCaches();
  }

  /**
   * Call after a team gets assigned a new slot (incremental update)
   */
  recordAssignment(teamId: string): void {
    const state = this.teamStates.get(teamId);
    if (!state) {return;}

    const newAvg = this.computeAvgRest(state.matchSlots);
    this.avgRestByTeam.set(teamId, newAvg);

    // Update global min/max
    this.globalMinAvg = Math.min(this.globalMinAvg, newAvg);
    this.globalMaxAvg = Math.max(this.globalMaxAvg, newAvg);

    // Clear stale projections for this team
    for (const key of this.projectionCache.keys()) {
      if (key.startsWith(teamId + '|')) {
        this.projectionCache.delete(key);
      }
    }
  }

  /**
   * Projected average rest if teamId plays in slot (what-if query)
   */
  projectedAvgRest(teamId: string, slot: number): number {
    const cacheKey = `${teamId}|${slot}`;
    const cached = this.projectionCache.get(cacheKey);
    if (cached !== undefined) {return cached;}

    const state = this.teamStates.get(teamId);
    if (!state) {return 0;}

    const projectedSlots = [...state.matchSlots, slot].sort((a, b) => a - b);
    const projAvg = this.computeAvgRest(projectedSlots);
    this.projectionCache.set(cacheKey, projAvg);
    return projAvg;
  }

  /**
   * Current global variance (maxAvg - minAvg) - O(1)
   */
  getGlobalVariance(): number {
    if (this.globalMinAvg === Infinity && this.globalMaxAvg === -Infinity) {
      return 0;
    }
    return this.globalMaxAvg - this.globalMinAvg;
  }

  /**
   * Get current average rest by team (for score calculation)
   */
  getAvgRestByTeam(): Map<string, number> {
    return new Map(this.avgRestByTeam);
  }

  /**
   * Rebuild all caches from scratch (called on initialization)
   */
  private rebuildAllCaches(): void {
    this.avgRestByTeam.clear();
    this.globalMinAvg = Infinity;
    this.globalMaxAvg = -Infinity;
    this.projectionCache.clear();

    for (const [teamId, state] of this.teamStates.entries()) {
      const avg = this.computeAvgRest(state.matchSlots);
      this.avgRestByTeam.set(teamId, avg);
      this.globalMinAvg = Math.min(this.globalMinAvg, avg);
      this.globalMaxAvg = Math.max(this.globalMaxAvg, avg);
    }
  }

  /**
   * Compute average rest between consecutive slots
   */
  private computeAvgRest(sortedSlots: number[]): number {
    if (sortedSlots.length < 2) {return 0;}
    let sum = 0;
    for (let i = 1; i < sortedSlots.length; i++) {
      sum += sortedSlots[i] - sortedSlots[i - 1];
    }
    return sum / (sortedSlots.length - 1);
  }

  /**
   * Reset all caches (useful for testing)
   */
  reset(): void {
    this.avgRestByTeam.clear();
    this.projectionCache.clear();
    this.globalMinAvg = Infinity;
    this.globalMaxAvg = -Infinity;
  }
}
