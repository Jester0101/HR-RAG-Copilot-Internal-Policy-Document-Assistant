const NO_INFO_PHRASES = [
  "information not found in company documents",
  "information not found",
  "no relevant information found",
  "no information found",
  "not found in company documents",
];

/**
 * Returns true when the assistant response is a variation of "no information found".
 */
export function isInfoNotFoundResponse(content?: string | null): boolean {
  if (!content) return false;
  const normalized = content.trim().toLowerCase();
  return NO_INFO_PHRASES.some((phrase) => normalized.includes(phrase));
}
