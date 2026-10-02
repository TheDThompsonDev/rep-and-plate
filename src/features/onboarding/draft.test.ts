import { describe, expect, it } from "vitest";
import { draftKey, parseDraft, emptyDraft } from "./draft";

describe("unfinished onboarding drafts", () => {
  it("restores the exact review and edited targets for the same identity", () => {
    const value = {
      ...emptyDraft("weight-1"),
      step: "nutrition",
      name: "Alex",
      nutritionSession: {
        review: "estimate",
        targets: { calories: "2500", protein: "130", carbs: "325", fat: "87" },
      },
    };
    expect(parseDraft(JSON.stringify(value))).toEqual(value);
  });
  it("rejects corrupt or credential-bearing drafts", () => {
    expect(parseDraft("{broken")).toBeNull();
    expect(parseDraft(" ".repeat(12001))).toBeNull();
    expect(
      parseDraft(
        JSON.stringify({ ...emptyDraft("weight-1"), password: "secret" }),
      ),
    ).toBeNull();
    expect(
      parseDraft(
        JSON.stringify({ ...emptyDraft("weight-1"), step: "entered" }),
      ),
    ).toBeNull();
  });
  it("separates guest and account drafts and does not collide with completion records", () => {
    expect(
      new Set([
        draftKey(null),
        draftKey("a"),
        draftKey("b"),
        "rep-and-plate.onboarding.v1",
      ]).size,
    ).toBe(4);
  });
});
