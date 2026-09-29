import { describe, expect, it } from "vitest";
import { componentNutrition } from "./arithmetic";
import { mealComponentSchema } from "./contracts";
import {
  normalizeProposalComponents,
  proposalComponentsSchema,
  sumProposalComponents,
  type ProposalComponent,
} from "./proposals";

const item = (
  name: string,
  portion: string,
  calories: number,
  protein = 0,
  carbs = 0,
  fat = 0,
): ProposalComponent => ({
  name,
  portion,
  nutrition: { calories, protein, carbs, fat },
});
const components = [
  item("Tea", "1 mug", 0),
  item("Whole milk", "1/2 cup", 75, 4, 6, 4),
  item("Vanilla syrup", "2 pumps", 40, 0, 10),
  item("Cooking oil", "1 tsp in side dish", 40, 0, 0, 4.5),
];

describe("meal component proposals", () => {
  it("keeps drinks, milk, syrup and oil distinct and sums their included portions once", () => {
    expect(sumProposalComponents(components)).toEqual({
      calories: 155,
      protein: 4,
      carbs: 16,
      fat: 8.5,
    });
    const saved = normalizeProposalComponents(components, "meal-1");
    expect(saved.map((component) => component.name)).toEqual(
      components.map((component) => component.name),
    );
    expect(saved.map((component) => component.servingLabel)).toEqual(
      components.map((component) => component.portion),
    );
    expect(componentNutrition(saved)).toEqual(
      sumProposalComponents(components),
    );
    expect(
      saved.every(
        (component) =>
          component.servings === 1 &&
          component.lotId === undefined &&
          component.sourceUrls.length === 0,
      ),
    ).toBe(true);
    for (const component of saved)
      expect(mealComponentSchema.safeParse(component).success).toBe(true);
  });
  it("rejects partial, negative, non-finite and oversized estimates instead of inventing zeroes", () => {
    for (const calories of [null, undefined, -1, NaN, Infinity, 20001])
      expect(
        proposalComponentsSchema.safeParse([
          {
            ...components[0],
            nutrition: { ...components[0].nutrition, calories },
          },
        ]).success,
      ).toBe(false);
    expect(proposalComponentsSchema.safeParse([]).success).toBe(false);
    expect(
      proposalComponentsSchema.safeParse(Array(21).fill(components[0])).success,
    ).toBe(false);
    expect(
      proposalComponentsSchema.safeParse([{ ...components[0], name: " " }])
        .success,
    ).toBe(false);
  });
  it("enforces the combined nutrient budgets even if each component is individually valid", () => {
    for (const [key, limit] of Object.entries({
      calories: 20000,
      protein: 2000,
      carbs: 5000,
      fat: 2000,
    })) {
      const part = {
        ...components[0],
        nutrition: { ...components[0].nutrition, [key]: limit },
      };
      expect(proposalComponentsSchema.safeParse([part, part]).success).toBe(
        false,
      );
    }
  });
  it("rounds totals consistently, assigns stable independent IDs and leaves source data unchanged", () => {
    const input = [
      item("Milk", "1 tbsp", 9.123),
      item("Milk", "1 tbsp", 9.123),
    ];
    const before = structuredClone(input);
    expect(sumProposalComponents(input).calories).toBe(18.25);
    expect(
      normalizeProposalComponents(input, "meal-2").map(
        (component) => component.id,
      ),
    ).toEqual(["meal-2:component:0", "meal-2:component:1"]);
    expect(input).toEqual(before);
    expect(() => normalizeProposalComponents(input, " ")).toThrow("identifier");
  });
});
