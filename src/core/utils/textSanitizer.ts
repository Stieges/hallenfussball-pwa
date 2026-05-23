/**
 * F-215: Sanitize free-text user input that is later rendered in UI / PDFs / exports.
 *
 * React already escapes JSX text content, so this is defense-in-depth for cases where
 * names land in attributes, downstream services, or non-React renderers.
 *
 * Strategy: strip HTML tags and control characters, collapse internal whitespace, trim.
 */
export function sanitizeTeamName(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    // Drop full tags including their content for known dangerous elements
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    // Drop any remaining tags
    .replace(/<\/?[a-z][^>]*>/gi, '')
    // Strip control chars (except tab and regular space)
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '')
    // Collapse runs of whitespace
    .replace(/\s+/g, ' ')
    .trim();
}
