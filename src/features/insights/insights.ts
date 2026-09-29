import type { AppState } from "../../domain";
import { today, personalMeals } from "../../domain";

type ComponentKind = "drinks" | "oils" | "sauces" | "syrups";
function componentKind(name: string): ComponentKind | null {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s+\((?:for cooking|pure)\)$/, "");
  if (
    /^(?:(?:whole|skim|skimmed|semi-skimmed|2%|1%|fat-free|low-fat|oat|almond|soy|coconut) )?milk$/.test(
      normalized,
    ) ||
    /^(?:(?:iced|black|green|herbal|sweet|unsweetened) )?(?:tea|coffee)$/.test(
      normalized,
    ) ||
    /^(?:chai latte|latte|cappuccino|hot chocolate|orange juice|apple juice|grape juice|cranberry juice|lemonade|cola|soda|protein shake|protein drink)$/.test(
      normalized,
    )
  )
    return "drinks";
  if (
    /^(?:(?:extra virgin|virgin) )?(?:olive|avocado|canola|vegetable|coconut|sunflower|sesame|peanut|cooking) oil$/.test(
      normalized,
    )
  )
    return "oils";
  if (
    /^(?:salsa|ketchup|mayonnaise|mustard|ranch dressing|salad dressing|soy sauce|teriyaki sauce|barbecue sauce|bbq sauce|hot sauce|tomato sauce|pesto)$/.test(
      normalized,
    )
  )
    return "sauces";
  if (
    /^(?:(?:vanilla|caramel|maple|chocolate|simple|agave) )?syrup$/.test(
      normalized,
    )
  )
    return "syrups";
  return null;
}

function componentInsight(meals: AppState["meals"], evidence: string) {
  const entries: {
    kind: ComponentKind;
    calories: number;
    detail: string;
    mealId: string;
  }[] = [];
  for (const meal of meals) {
    const components = meal.components;
    if (!components?.length) continue;
    // Components may cover only part of a meal; never stack them on the meal's total.
    // Inconsistent or duplicate breakdowns need review before they support an insight.
    if (
      new Set(components.map((component) => component.id)).size !==
        components.length ||
      components.some(
        (component) =>
          !Number.isFinite(component.nutrition.calories) ||
          component.nutrition.calories < 0,
      ) ||
      components.reduce(
        (sum, component) => sum + component.nutrition.calories,
        0,
      ) >
        meal.calories + 0.01
    )
      continue;
    for (const component of components) {
      const kind = componentKind(component.name);
      if (
        !kind ||
        component.nutrition.calories <= 0 ||
        !Number.isFinite(component.servings) ||
        component.servings <= 0 ||
        !component.servingLabel.trim()
      )
        continue;
      entries.push({
        kind,
        calories: component.nutrition.calories,
        mealId: meal.id,
        detail: `${meal.day} · ${meal.title}: ${component.name} · ${component.servings} × ${component.servingLabel} · ${component.nutrition.calories} recorded cal`,
      });
    }
  }
  if (!entries.length) return null;
  const kinds = [...new Set(entries.map((entry) => entry.kind))];
  const category =
    kinds.length === 1
      ? kinds[0]
      : `${kinds.slice(0, -1).join(", ")} and ${kinds[kinds.length - 1]}`;
  const calories =
    Math.round(entries.reduce((sum, entry) => sum + entry.calories, 0) * 100) /
    100;
  const count = new Set(entries.map((entry) => entry.mealId)).size;
  return {
    tone: kinds.includes("oils") || kinds.includes("sauces") ? "oil" : "drinks",
    title: `${calories} recorded calories from ${category}.`,
    description: `${entries.length} saved ${entries.length === 1 ? "component" : "components"} across ${count} ${count === 1 ? "meal" : "meals"}.`,
    detail: `These are saved component estimates for the portions shown, already included in the meals' recorded totals. They are not additional calories or a comparison with your target. Only clearly named components with known amounts are included; other meals may have no breakdown or only a partial one.\n\n${entries.map((entry) => entry.detail).join("\n")}`,
    evidence,
  };
}

export function nutritionInsights(state: AppState, end = today()) {
  const fromDate = new Date(`${end}T12:00:00`);
  fromDate.setDate(fromDate.getDate() - 6);
  const start = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, "0")}-${String(fromDate.getDate()).padStart(2, "0")}`;
  const meals = personalMeals(state.meals).filter(
    (m) =>
      m.day >= start &&
      m.day <= end,
  );
  const evidence = `${start} to ${end} · ${meals.length} saved ${meals.length === 1 ? "meal" : "meals"} · sample records excluded`;
  if (!meals.length)
    return [
      {
        tone: "protein",
        title: "Your next meal starts the picture.",
        description: "Log your own meals to see a weekly review here.",
        detail:
          "There aren't any personal meal records in the last seven days. Example meals don't establish a pattern about you.",
        evidence,
      },
    ];
  const days = new Map<string, { protein: number; calories: number }>();
  for (const meal of meals) {
    const current = days.get(meal.day) ?? { protein: 0, calories: 0 };
    current.protein += meal.protein;
    current.calories += meal.calories;
    days.set(meal.day, current);
  }
  const sum = [...days.values()].reduce(
    (a, b) => ({
      protein: a.protein + b.protein,
      calories: a.calories + b.calories,
    }),
    { protein: 0, calories: 0 },
  );
  const reached = [...days.values()].filter(
    (d) => d.protein >= state.profile.protein,
  ).length;
  const records = meals
    .map(
      (m) => `${m.day}: ${m.title} (${m.calories} cal, ${m.protein}g protein)`,
    )
    .join("\n");
  return [
    {
      tone: "protein",
      title: `${meals.length} ${meals.length === 1 ? "meal" : "meals"} across ${days.size} logged ${days.size === 1 ? "day" : "days"}.`,
      description: `Average recorded intake: ${Math.round(sum.calories / days.size)} calories per logged day.`,
      detail: `This average includes only days with personal meal records, not unlogged days. It may be incomplete if meals are missing.\n\n${records}`,
      evidence,
    },
    {
      tone: "protein",
      title: `${Math.round(sum.protein / days.size)}g protein per logged day.`,
      description: `${reached} of ${days.size} logged ${days.size === 1 ? "day" : "days"} reached your current ${state.profile.protein}g target.`,
      detail: `Compared with your current target; past targets may have differed. This describes recorded meals and does not assume each day's log is complete.\n\n${records}`,
      evidence,
    },
    componentInsight(meals, evidence) ?? {
      tone: "oil",
      title: "Your estimates stay editable.",
      description: `${meals.filter((m) => m.confidence === "estimated").length} of these meals still use estimated nutrition.`,
      detail: `Portion sizes, cooking oils, and drinks can change a meal's totals. Review a record when you have better information; Rep & Plate recalculates this review from saved values.\n\n${records}`,
      evidence,
    },
  ];
}
