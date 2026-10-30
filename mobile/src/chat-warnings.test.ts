import { describe, expect, it } from "vitest";
import { visibleWarnings } from "./chat-warnings";

describe("visibleWarnings", () => {
  it("returns nothing when the server sent no warnings", () => {
    expect(visibleWarnings({})).toEqual([]);
    expect(visibleWarnings({ warnings: [] })).toEqual([]);
  });
  it("keeps a Spot Check warning when the meal card was withheld", () => {
    expect(
      visibleWarnings({ warnings: ["Spot Check: which date was this meal?"] }),
    ).toEqual(["Spot Check: which date was this meal?"]);
  });
  it("drops blank and repeated warnings so the card is never empty", () => {
    expect(
      visibleWarnings({
        warnings: [
          "  ",
          "Some product matches need a check. Unknown nutrition is left blank.",
          "Some product matches need a check. Unknown nutrition is left blank.",
          "",
        ],
      }),
    ).toEqual([
      "Some product matches need a check. Unknown nutrition is left blank.",
    ]);
  });
});
