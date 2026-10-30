import type { Message } from "../../src/domain";
/**
 * Server warnings worth showing under an assistant message. The server appends
 * one string per check it could not clear (for example a Spot Check about the
 * meal's date), and the web renders each one; native reads the same field.
 * Blank strings and exact repeats are dropped so a card is never empty.
 */
export function visibleWarnings(message: Pick<Message, "warnings">): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const warning of message.warnings ?? []) {
    const text = warning.trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
}
