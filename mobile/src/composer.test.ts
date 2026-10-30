import { describe, expect, it } from "vitest";
import { PROCESSING_DRAFT_NOTICE } from "../../src/ai-client";
import { holdWhileReplying } from "./composer";

// Audit follow-up (CHAT-COMPOSER-001): a transcript or typed message that
// arrives while Spot is still replying is held in the composer, never dropped.
describe("holdWhileReplying", () => {
  it("puts a voice transcript into an empty composer and explains why it was not sent", () => {
    expect(holdWhileReplying("", "Two eggs and toast")).toEqual({
      draft: "Two eggs and toast",
      notice: PROCESSING_DRAFT_NOTICE,
    });
  });
  it("joins a transcript onto a draft the user was already typing", () => {
    expect(holdWhileReplying("Coffee with milk ", " and toast").draft).toBe(
      "Coffee with milk and toast",
    );
  });
  it("does not duplicate a typed draft the composer resubmits", () => {
    expect(holdWhileReplying("Second thought", "Second thought").draft).toBe(
      "Second thought",
    );
  });
});
