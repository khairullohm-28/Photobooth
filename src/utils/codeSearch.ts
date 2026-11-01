/**
 * Utility functions for photo code formatting and tolerant search matching.
 */

/**
 * Formats a sequential counter number into code, e.g. KL-0042
 */
export function formatSessionCode(prefix: string, counter: number): string {
  const cleanPrefix = (prefix || 'PB').toUpperCase().trim();
  const numStr = counter.toString().padStart(4, '0');
  return `${cleanPrefix}-${numStr}`;
}

/**
 * Normalizes a code or query string for tolerant matching:
 * - lowercase
 * - removes all spaces, hyphens, and underscores
 */
export function normalizeCodeForMatching(input: string): string {
  return (input || '').toLowerCase().replace(/[\s\-_]/g, '');
}

/**
 * Extracts a session ID if the query is a full URL or contains a UUID
 */
export function extractSessionIdFromUrlOrText(input: string): string | null {
  if (!input) return null;

  // Check URL pattern /e/:slug/s/:sessionId
  const urlMatch = input.match(/\/s\/([a-zA-Z0-9_\-]+)/);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  // Check UUID format (8-4-4-4-12)
  const uuidMatch = input.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  if (uuidMatch) {
    return uuidMatch[0];
  }

  return null;
}

/**
 * Parses multiple codes separated by spaces, commas, semicolons, or newlines
 */
export function parseMultipleCodes(input: string): string[] {
  if (!input) return [];
  return input
    .split(/[\s,;\n\r]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/**
 * Tolerant matcher for a search query against a session's code, id, or number
 */
export function isTolerantMatch(
  query: string,
  sessionCode: string | undefined,
  sessionId: string,
  currentEventPrefix: string = ''
): boolean {
  if (!query || !query.trim()) return true;

  const rawQuery = query.trim();
  const normalizedQuery = normalizeCodeForMatching(rawQuery);

  // 1. Check exact or partial session ID (UUID or URL)
  const extractedId = extractSessionIdFromUrlOrText(rawQuery);
  if (extractedId) {
    if (sessionId.toLowerCase().includes(extractedId.toLowerCase())) {
      return true;
    }
  }

  if (sessionId.toLowerCase().includes(rawQuery.toLowerCase())) {
    return true;
  }

  if (!sessionCode) return false;

  const normalizedSessionCode = normalizeCodeForMatching(sessionCode);

  // 2. Direct normalized match (e.g. "mnd42" matches "MND-0042")
  if (normalizedSessionCode.includes(normalizedQuery)) {
    return true;
  }

  // 3. Number-only match: e.g. user enters "42" or "0042"
  const queryOnlyDigits = rawQuery.replace(/\D/g, '');
  if (queryOnlyDigits.length > 0) {
    const sessionOnlyDigits = sessionCode.replace(/\D/g, '');
    const queryNum = parseInt(queryOnlyDigits, 10);
    const sessionNum = parseInt(sessionOnlyDigits, 10);

    if (queryNum === sessionNum) {
      return true;
    }

    if (sessionOnlyDigits.endsWith(queryOnlyDigits)) {
      return true;
    }

    // Prefix + digits match: e.g. "kl42" matches KL-0042
    if (currentEventPrefix) {
      const constructed = normalizeCodeForMatching(`${currentEventPrefix}${queryNum}`);
      if (normalizedSessionCode === normalizeCodeForMatching(`${currentEventPrefix}${sessionNum}`)) {
        return true;
      }
    }
  }

  return false;
}
