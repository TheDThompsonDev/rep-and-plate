import { describe, expect, it } from "vitest";
import {
  CHAT_INPUT_LIMIT,
  dayDividerLabel,
  dayKey,
  isNearBottom,
  remainingCharacters,
  scrollBehavior,
  showRemaining,
} from "./chat-thread";

describe("thread anchoring math", () => {
  it("counts the reader as at the bottom within the threshold only", () => {
    expect(isNearBottom({ scrollTop: 0, scrollHeight: 500, clientHeight: 500 })).toBe(true);
    expect(isNearBottom({ scrollTop: 460, scrollHeight: 1000, clientHeight: 500 })).toBe(true);
    expect(isNearBottom({ scrollTop: 452, scrollHeight: 1000, clientHeight: 500 })).toBe(true);
    expect(isNearBottom({ scrollTop: 451, scrollHeight: 1000, clientHeight: 500 })).toBe(false);
    expect(isNearBottom({ scrollTop: 0, scrollHeight: 1000, clientHeight: 500 })).toBe(false);
  });
  it("accepts a custom threshold and tolerates fractional overscroll", () => {
    expect(isNearBottom({ scrollTop: 400, scrollHeight: 1000, clientHeight: 500 }, 100)).toBe(true);
    expect(isNearBottom({ scrollTop: 399, scrollHeight: 1000, clientHeight: 500 }, 100)).toBe(false);
    expect(isNearBottom({ scrollTop: 500.4, scrollHeight: 1000, clientHeight: 500 })).toBe(true);
  });
  it("uses instant scrolling when the reader prefers reduced motion", () => {
    expect(scrollBehavior(true)).toBe("auto");
    expect(scrollBehavior(false)).toBe("smooth");
  });
});

describe("day dividers", () => {
  const local = (y: number, m: number, d: number, h = 9) => new Date(y, m - 1, d, h, 5).toISOString();
  const now = new Date(2026, 9, 10, 15, 0);
  it("keys an ISO timestamp by local day and rejects unreadable values", () => {
    expect(dayKey(local(2026, 10, 9, 23))).toBe("2026-10-09");
    expect(dayKey(local(2026, 10, 10, 0))).toBe("2026-10-10");
    expect(dayKey("not a date")).toBeNull();
    expect(dayKey(undefined)).toBeNull();
  });
  it("labels the first stamped message and each change of day, never same-day neighbours", () => {
    expect(dayDividerLabel(undefined, { at: local(2026, 10, 10) }, now)).toBe("Today");
    expect(dayDividerLabel({ at: local(2026, 10, 9, 23) }, { at: local(2026, 10, 10, 0) }, now)).toBe("Today");
    expect(dayDividerLabel(undefined, { at: local(2026, 10, 9) }, now)).toBe("Yesterday");
    expect(dayDividerLabel({ at: local(2026, 10, 10, 8) }, { at: local(2026, 10, 10, 9) }, now)).toBeNull();
  });
  it("renders nothing for records without timestamps", () => {
    expect(dayDividerLabel(undefined, {}, now)).toBeNull();
    expect(dayDividerLabel({ at: local(2026, 10, 9) }, {}, now)).toBeNull();
    // Predecessor exists but is unstamped: the day change is unknown.
    expect(dayDividerLabel({}, { at: local(2026, 10, 10) }, now)).toBeNull();
  });
  it("spells out older days and adds the year when it differs", () => {
    expect(dayDividerLabel({ at: local(2026, 10, 9) }, { at: local(2026, 10, 3) }, now)).toBe("Saturday, Oct 3");
    expect(dayDividerLabel({ at: local(2026, 10, 9) }, { at: local(2025, 12, 31) }, now)).toBe("Wednesday, Dec 31, 2025");
  });
});

describe("composer limit", () => {
  it("shares the server limit", () => {
    expect(CHAT_INPUT_LIMIT).toBe(4000);
  });
  it("shows remaining characters only near the limit", () => {
    expect(showRemaining("")).toBe(false);
    expect(showRemaining("a".repeat(CHAT_INPUT_LIMIT - 201))).toBe(false);
    expect(showRemaining("a".repeat(CHAT_INPUT_LIMIT - 200))).toBe(true);
    expect(showRemaining("a".repeat(CHAT_INPUT_LIMIT))).toBe(true);
    expect(remainingCharacters("a".repeat(CHAT_INPUT_LIMIT))).toBe(0);
    expect(remainingCharacters("abc")).toBe(CHAT_INPUT_LIMIT - 3);
  });
  it("never reports a negative remainder for over-long pasted text", () => {
    expect(remainingCharacters("a".repeat(CHAT_INPUT_LIMIT + 5))).toBe(0);
  });
});
