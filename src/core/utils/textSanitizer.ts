/**
 * F-215: Sanitize free-text user input that is later rendered in UI / PDFs / exports.
 *
 * React already escapes JSX text content, so this is defense-in-depth for cases where
 * names land in attributes, downstream services, or non-React renderers.
 *
 * Strategy: team names never legitimately contain '<' or '>'. We strip every angle
 * bracket plus ASCII control characters and collapse whitespace. This avoids the
 * known pitfalls of sequential regex-based tag stripping (CodeQL
 * js/incomplete-multi-character-sanitization, js/bad-tag-filter): no nested-tag
 * residue can survive, because no `<` or `>` remains in the output at all.
 */
export function sanitizeTeamName(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    // Drop any character that could open or close an HTML/XML construct.
    .replace(/[<>]/g, '')
    // Strip ASCII control chars (except tab/space which whitespace-collapse handles)
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '')
    // Collapse runs of whitespace
    .replace(/\s+/g, ' ')
    .trim();
}
