// Pure helpers for the Chat thread: scroll anchoring, day dividers and the
// composer limit. No DOM access, so ChatLayer stays the only React consumer
// and the maths is unit-tested on its own.
import { CHAT_INPUT_LIMIT } from "./ai-contract";

export { CHAT_INPUT_LIMIT };

/** Below this many characters remaining the composer shows a countdown. */
export const COMPOSER_WARNING_WINDOW = 200;
/** Within this many pixels of the bottom the reader counts as "at the bottom". */
export const BOTTOM_THRESHOLD = 48;

export type ScrollMetrics = {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
};

export function isNearBottom(
  { scrollTop, scrollHeight, clientHeight }: ScrollMetrics,
  threshold = BOTTOM_THRESHOLD,
): boolean {
  return scrollHeight - scrollTop - clientHeight <= threshold;
}

export function scrollBehavior(reducedMotion: boolean): ScrollBehavior {
  return reducedMotion ? "auto" : "smooth";
}

const pad = (value: number) => String(value).padStart(2, "0");
const localDay = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Local calendar day (`YYYY-MM-DD`) of an ISO instant, or null when absent or unreadable. */
export function dayKey(at: string | undefined): string | null {
  if (!at) return null;
  const parsed = new Date(at);
  return Number.isNaN(parsed.getTime()) ? null : localDay(parsed);
}

function dayLabel(date: Date, now: Date): string {
  const key = localDay(date);
  if (key === localDay(now)) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (key === localDay(yesterday)) return "Yesterday";
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

/** Label for a divider rendered above `current`, or null for none. A divider
 * appears when `current` is stamped and either opens the list or falls on a
 * different local day from a stamped predecessor. An unstamped predecessor
 * leaves the change of day unknown, so no divider is drawn. */
export function dayDividerLabel(
  previous: { at?: string } | undefined,
  current: { at?: string },
  now = new Date(),
): string | null {
  const currentKey = dayKey(current.at);
  if (!currentKey) return null;
  if (previous) {
    const previousKey = dayKey(previous.at);
    if (!previousKey || previousKey === currentKey) return null;
  }
  return dayLabel(new Date(current.at as string), now);
}

export function remainingCharacters(value: string, limit = CHAT_INPUT_LIMIT): number {
  return Math.max(0, limit - value.length);
}

export function showRemaining(value: string, limit = CHAT_INPUT_LIMIT): boolean {
  return limit - value.length <= COMPOSER_WARNING_WINDOW;
}
