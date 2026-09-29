import { it, expect } from "vitest";
import { demoState, initialState, today, type Meal } from "../../domain";
import type { MealComponent } from "../meals/contracts";
import { nutritionInsights } from "./insights";
it("excludes sample records and unlogged days from personal patterns", () => {
  const state = initialState();
  expect(nutritionInsights(state)[0].title).toContain("next meal");
  state.meals.push({
    ...demoState().meals[0],
    example: false,
    id: "own",
    source: "Your pantry",
    day: today(),
    calories: 200,
    protein: 30,
  });
  const cards = nutritionInsights(state);
  expect(cards[0].title).toBe("1 meal across 1 logged day.");
  expect(cards[0].description).toContain("200 calories");
  expect(cards[1].title).toContain("30g");
});

const component = (
  id: string,
  name: string,
  calories: number,
  servings = 1,
): MealComponent => ({
  id,
  name,
  servings,
  servingLabel: "1 tablespoon",
  nutrition: { calories, protein: 0, carbs: 0, fat: 0 },
  sourceUrls: [],
});
function ownMeal(id: string, components?: MealComponent[]): Meal {
  return {
    ...demoState().meals[0],
    example: false,
    id,
    source: "Your pantry",
    title: `Meal ${id}`,
    day: "2026-09-25",
    calories: 600,
    components,
  };

  it("accepts only harmless explicit cooking and purity suffixes", () => {
    const state = initialState();
    state.meals = [
      ownMeal("suffix", [
        component("a", "Olive oil (for cooking)", 40),
        component("b", "Maple syrup (pure)", 20),
        component("c", "Milk (in cake)", 100),
        component("d", "Olive oil (not used)", 100),
      ]),
    ];
    expect(nutritionInsights(state, "2026-09-25")[2].title).toBe(
      "60 recorded calories from oils and syrups.",
    );
  });
}

it("shows actual component evidence without adding meal calories or multiplying portions again", () => {
  const state = initialState();
  state.meals = [
    ownMeal("one", [
      component("oil", "Olive oil", 80, 2),
      component("milk", "Whole milk", 75, 0.5),
    ]),
    ownMeal("two", [
      component("syrup", "Vanilla syrup", 40),
      component("salsa", "Salsa", 10),
    ]),
  ];
  const cards = nutritionInsights(state, "2026-09-25");
  expect(cards).toHaveLength(3);
  expect(cards[2].title).toBe(
    "205 recorded calories from oils, drinks, syrups and sauces.",
  );
  expect(cards[2].description).toBe("4 saved components across 2 meals.");
  expect(cards[2].detail).toContain(
    "Meal one: Olive oil · 2 × 1 tablespoon · 80 recorded cal",
  );
  expect(cards[2].detail).toContain("already included");
  expect(cards[0].description).toContain("1200 calories");
});

it("does not infer components from meal titles, ambiguous foods or zero-calorie drinks", () => {
  const state = initialState();
  state.meals = [
    { ...ownMeal("whole-name"), title: "Whole milk" },
    ownMeal("ambiguous", [
      component("a", "Milk chocolate", 100),
      component("b", "Coconut milk soup", 100),
      component("c", "Oil-free dressing", 50),
      component("d", "Coffee cake", 100),
      component("e", "Black coffee", 0),
    ]),
  ];
  expect(nutritionInsights(state, "2026-09-25")[2].title).toBe(
    "Your estimates stay editable.",
  );
});

it("excludes sample and out-of-window meals while retaining partial known component evidence", () => {
  const state = initialState();
  state.meals = [
    {
      ...ownMeal("sample", [component("a", "Olive oil", 400)]),
      source: "Sample meal",
    },
    {
      ...ownMeal("old", [component("b", "Olive oil", 400)]),
      day: "2026-09-18",
    },
    ownMeal("current", [component("c", "Whole milk", 75)]),
  ];
  const card = nutritionInsights(state, "2026-09-25")[2];
  expect(card.title).toBe("75 recorded calories from drinks.");
  expect(card.description).toBe("1 saved component across 1 meal.");
  expect(card.detail).not.toContain("Meal sample");
  expect(card.detail).not.toContain("Meal old");
});

it("omits unknown calories, quantities, duplicate IDs and overlapping breakdowns", () => {
  const state = initialState();
  state.meals = [
    ownMeal("unknown", [component("a", "Olive oil", NaN)]),
    ownMeal("portion", [component("b", "Whole milk", 75, NaN)]),
    ownMeal("duplicate", [
      component("c", "Salsa", 10),
      component("c", "Salsa", 10),
    ]),
    { ...ownMeal("overlap", [component("d", "Olive oil", 100)]), calories: 80 },
  ];
  expect(nutritionInsights(state, "2026-09-25")[2].title).toBe(
    "Your estimates stay editable.",
  );
});
