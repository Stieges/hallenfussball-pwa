/**
 * Group Helper Functions
 *
 * Utilities for working with unlimited group names
 */

/**
 * Generate group label from index
 * 0 -> 'A', 1 -> 'B', ..., 25 -> 'Z', 26 -> 'AA', 27 -> 'AB', etc.
 */
export function getGroupLabel(index: number): string {
  if (index < 0) {return '';}

  let label = '';
  let num = index;

  do {
    label = String.fromCharCode(65 + (num % 26)) + label;
    num = Math.floor(num / 26) - 1;
  } while (num >= 0);

  return label;
}

/**
 * Generate array of group labels for a given count
 * generateGroupLabels(3) -> ['A', 'B', 'C']
 * generateGroupLabels(28) -> ['A', 'B', ..., 'Z', 'AA', 'AB']
 */
export function generateGroupLabels(count: number): string[] {
  const labels: string[] = [];
  for (let i = 0; i < count; i++) {
    labels.push(getGroupLabel(i));
  }
  return labels;
}

/**
 * Get all unique groups from a team list
 */
export function getUniqueGroups(teams: Array<{ group?: string }>): string[] {
  const groups = new Set<string>();
  teams.forEach(team => {
    if (team.group) {
      groups.add(team.group);
    }
  });
  return Array.from(groups).sort();
}
