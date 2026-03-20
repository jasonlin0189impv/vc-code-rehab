/**
 * Approximates LLM token count from character count using the GPT-4 heuristic:
 * ~4 characters per token on average for code/English.
 */
export function charsToTokens(charCount: number): number {
  return Math.ceil(charCount / 4);
}
