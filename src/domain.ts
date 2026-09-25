import { z } from "zod";
import {
  groceryReceiptSchema,
  mealProposalSchema,
  sourceSchema,
} from "./ai-contract";

export const APP_NAME = "Fuel";
export const STORAGE_KEY = "fuel.prototype.v1";
const amount = z.number().finite().min(0).max(20000);
export const nutritionSchema = z.object({
  calories: amount,
  protein: amount,
  carbs: amount,
  fat: amount,
});
export type Nutrition = z.infer<typeof nutritionSchema>;
export const mealSchema = nutritionSchema.extend({
  id: z.string(),
  title: z.string(),
  category: z.enum(["Breakfast", "Lunch", "Dinner", "Snack"]),
  time: z.string(),
  day: z.string(),
  source: z.string(),
  confidence: z.enum(["estimated", "confirmed"]),
  image: z.string().optional(),
  note: z.string(),
});
export type Meal = z.infer<typeof mealSchema>;
const reviewSchema = z.object({
  id: z.string(),
  title: z.string(),
  question: z.string(),
  options: z.array(z.string()),
  source: z.string(),
  image: z.string().optional(),
  kind: z.enum(["protein", "fries", "capture"]),
  resolved: z.boolean(),
  answer: z.string().optional(),
});
export type ReviewItem = z.infer<typeof reviewSchema>;
const messageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  text: z.string(),
  time: z.string(),
  image: z.string().optional(),
  mealId: z.string().optional(),
  ai: z.boolean().optional(),
  aiStatus: z.enum(["pending", "complete", "error"]).optional(),
  aiError: z.string().optional(),
  requestId: z.string().optional(),
  receiptId: z.string().optional(),
  mealProposal: mealProposalSchema.optional(),
  sources: z.array(sourceSchema).optional(),
  warnings: z.array(z.string()).optional(),
  kind: z.enum(["insight", "summary", "workout", "review"]).optional(),
});
export type Message = z.infer<typeof messageSchema>;
export const exerciseSchema = z.object({
  name: z.string(),
  weight: amount,
  target: z.number().int().positive(),
  previous: z.array(z.number()),
  sets: z.array(z.number().int().min(0).max(100).nullable()),
});
export type Exercise = z.infer<typeof exerciseSchema>;
export const stateSchema = z.object({
  version: z.literal(1),
  groceries: z.array(groceryReceiptSchema).optional(),
  chatRevision: z.number().optional(),
  pendingMeal: z
    .object({ key: z.literal("dinner"), image: z.string().optional() })
    .optional(),
  profile: z.object({
    name: z.string().min(1),
    calories: z.number().min(1).max(10000),
    protein: z.number().min(1).max(1000),
    carbs: z.number().min(1).max(2000),
    fat: z.number().min(1).max(1000),
  }),
  meals: z.array(mealSchema),
  reviews: z.array(reviewSchema),
  messages: z.array(messageSchema),
  workout: z.object({
    planId: z.string().optional(),
    title: z.string().optional(),
    conversation: z
      .array(
        messageSchema.extend({
          exerciseIndex: z.number().int().nonnegative().optional(),
        }),
      )
      .optional(),
    history: z
      .array(
        z.object({
          title: z.string(),
          exercises: z.array(exerciseSchema),
          startedAt: z.string().nullable(),
          finishedAt: z.string().nullable(),
        }),
      )
      .optional(),
    status: z.enum(["ready", "active", "finished"]),
    exercises: z.array(exerciseSchema),
    startedAt: z.string().nullable(),
    finishedAt: z.string().nullable(),
  }),
});
export type AppState = z.infer<typeof stateSchema>;
export type Page =
  "Today" | "Chat" | "Nutrition" | "Workouts" | "Review" | "You";
export const id = () => crypto.randomUUID();
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const clockTime = () =>
  new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
export function sumNutrition(meals: Meal[], day = today()): Nutrition {
  return meals
    .filter((m) => m.day === day)
    .reduce(
      (s, m) => ({
        calories: s.calories + m.calories,
        protein: s.protein + m.protein,
        carbs: s.carbs + m.carbs,
        fat: s.fat + m.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
}
export function initialState(): AppState {
  return {
    version: 1,
    chatRevision: 2,
    profile: {
      name: "Danny",
      calories: 2000,
      protein: 110,
      carbs: 250,
      fat: 78,
    },
    meals: [
      {
        id: "breakfast",
        title: "Avocado toast & eggs",
        category: "Breakfast",
        calories: 390,
        protein: 18,
        carbs: 35,
        fat: 20,
        time: "8:32 AM",
        day: today(),
        source: "Sample meal · photo estimate",
        confidence: "estimated",
        image: "/images/breakfast.jpg",
        note: "Two eggs, sourdough, and half an avocado. Portion sizes are estimates.",
      },
      {
        id: "lunch",
        title: "Mediterranean chicken bowl",
        category: "Lunch",
        calories: 710,
        protein: 36,
        carbs: 75,
        fat: 30,
        time: "12:46 PM",
        day: today(),
        source: "Sample meal · order screenshot",
        confidence: "estimated",
        image: "/images/bowl.jpg",
        note: "Chicken, rice, hummus, vegetables, and dressing. Dressing quantity is the biggest uncertainty.",
      },
      {
        id: "coffee",
        title: "Afternoon iced latte",
        category: "Snack",
        calories: 260,
        protein: 4,
        carbs: 30,
        fat: 14,
        time: "3:15 PM",
        day: today(),
        source: "Sample meal · text capture",
        confidence: "estimated",
        note: "A sweetened iced latte. Milk and syrup quantities are estimated.",
      },
      referenceDinner(),
    ],
    reviews: [
      {
        id: "review-protein",
        title: "One detail about yesterday’s dinner",
        question: "Was this chicken or steak?",
        options: ["Chicken", "Steak"],
        source: "Yesterday · 7:12 PM · sample photo",
        image: "/images/bowl.jpg",
        kind: "protein",
        resolved: false,
      },
      {
        id: "review-fries",
        title: "And those fries at lunch…",
        question: "How much did you finish?",
        options: ["All of them", "About half", "None"],
        source: "Yesterday · 12:30 PM · sample order",
        kind: "fries",
        resolved: false,
      },
    ],
    messages: referenceConversation(),
    workout: {
      status: "ready",
      startedAt: null,
      finishedAt: null,
      exercises: [
        {
          name: "Bench Press",
          weight: 185,
          target: 8,
          previous: [8, 8, 7],
          sets: [null, null, null],
        },
        {
          name: "Incline Dumbbell Press",
          weight: 60,
          target: 10,
          previous: [10, 10, 9],
          sets: [null, null, null],
        },
        {
          name: "Seated Cable Row",
          weight: 120,
          target: 12,
          previous: [12, 12, 11],
          sets: [null, null, null],
        },
        {
          name: "Lateral Raise",
          weight: 20,
          target: 12,
          previous: [12, 11, 10],
          sets: [null, null, null],
        },
        {
          name: "Triceps Pushdown",
          weight: 50,
          target: 12,
          previous: [12, 12, 12],
          sets: [null, null, null],
        },
      ],
    },
  };
}
export function readState(): AppState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return upgradeChat(stateSchema.parse(JSON.parse(saved)));
  } catch {
    /* Invalid or outdated snapshots fall back to a fresh demo. */
  }
  return initialState();
}
function referenceDinner(): Meal {
  return {
    id: "chat-demo-dinner",
    title: "Grilled Chicken, Rice, Broccoli",
    category: "Dinner",
    calories: 610,
    protein: 49,
    carbs: 58,
    fat: 20,
    time: "6:29 PM",
    day: today(),
    source: "Sample conversation · estimated meal",
    confidence: "estimated",
    image: "/images/chicken-dinner.png",
    note: "High confidence on chicken and broccoli. Lower confidence on sauce quantity. Sample nutrition, not an analyzed image.",
  };
}
function referenceConversation(): Message[] {
  return [
    {
      id: "demo-dinner-photo",
      role: "user",
      text: "Made this for dinner",
      image: "/images/chicken-dinner.png",
      time: "6:28 PM",
    },
    {
      id: "demo-dinner-recognized",
      role: "assistant",
      text: "Looks like grilled chicken breast, rice, broccoli, and a light sauce.",
      time: "6:28 PM",
    },
    {
      id: "demo-dinner-question",
      role: "assistant",
      text: "Was that about 1 cup of rice?",
      time: "6:28 PM",
    },
    { id: "demo-dinner-confirmed", role: "user", text: "Yep", time: "6:29 PM" },
    {
      id: "demo-dinner-card",
      role: "assistant",
      text: "",
      time: "6:29 PM",
      mealId: "chat-demo-dinner",
    },
    {
      id: "demo-dinner-insight",
      role: "assistant",
      text: "You’re on track to hit your protein goal today.",
      time: "6:29 PM",
      kind: "insight",
    },
  ];
}
// Refresh only the old built-in conversation; retain every user-created capture and edit.
export function upgradeChat(state: AppState): AppState {
  if (state.chatRevision === 2) return state;
  const oldIds = new Set(["intro", "user-lunch", "assistant-lunch"]);
  if (!state.messages.some((m) => oldIds.has(m.id)))
    return { ...state, chatRevision: 2 };
  return {
    ...state,
    chatRevision: 2,
    meals: state.meals.some((m) => m.id === "chat-demo-dinner")
      ? state.meals
      : [...state.meals, referenceDinner()],
    messages: [
      ...referenceConversation(),
      ...state.messages.filter((m) => !oldIds.has(m.id)),
    ],
  };
}
export const demoMeals = {
  dinner: {
    title: "Grilled chicken, rice & broccoli",
    category: "Dinner" as const,
    calories: 610,
    protein: 49,
    carbs: 58,
    fat: 20,
    note: "Demo photo estimate. High confidence on chicken and broccoli; lower confidence on sauce quantity.",
  },
  takeout: {
    title: "Chicken shawarma bowl + sides",
    category: "Lunch" as const,
    calories: 870,
    protein: 52,
    carbs: 96,
    fat: 31,
    note: "Demo order estimate: chicken shawarma, hummus, pita, and Diet Coke. Restaurant nutrition has not been looked up.",
  },
  shake: {
    title: "Protein shake",
    category: "Snack" as const,
    calories: 160,
    protein: 30,
    carbs: 5,
    fat: 2,
    note: "Demo estimate for one scoop with water. Edit to match your brand and portion.",
  },
};
export function makeMeal(
  key: keyof typeof demoMeals,
  source: string,
  image?: string,
): Meal {
  return {
    ...demoMeals[key],
    id: id(),
    source,
    image,
    time: clockTime(),
    day: today(),
    confidence: "estimated",
  };
}
export type Interpretation =
  | { kind: "meal"; key: keyof typeof demoMeals }
  | { kind: "repeat" }
  | { kind: "workout"; weight: number; reps: number[] }
  | { kind: "unknown" };
// Deliberately small local parser. Unrecognized captures enter Review; no model is called.
export function interpretText(text: string): Interpretation {
  const t = text.trim().toLowerCase();
  const bench = t.match(
    /^bench(?: press)?(?: was)?\s+(\d+(?:\.\d+)?)\s*(?:lb|lbs)?\s*(?:for|x|×)\s*(\d{1,2})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})[.!]?$/,
  );
  if (
    bench &&
    Number(bench[1]) <= 2000 &&
    bench.slice(2).every((n) => Number(n) > 0)
  )
    return {
      kind: "workout",
      weight: Number(bench[1]),
      reps: bench.slice(2).map(Number),
    };
  if (/^(?:a |had a |i had a )?protein shake(?: after the gym)?[.!]?$/.test(t))
    return { kind: "meal", key: "shake" };
  if (
    /^(?:had |i had )?(?:grilled )?chicken,? (?:and |with )?rice (?:and |& )broccoli(?: for dinner)?[.!]?$/.test(
      t,
    )
  )
    return { kind: "meal", key: "dinner" };
  if (/^same breakfast as (?:yesterday|before)[.!]?$/.test(t))
    return { kind: "repeat" };
  return { kind: "unknown" };
}
export function resolveReview(
  state: AppState,
  reviewId: string,
  answer: string,
): AppState {
  const item = state.reviews.find((r) => r.id === reviewId);
  if (!item || item.resolved || !item.options.includes(answer)) return state;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const day = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
  let meal: Meal | undefined;
  if (item.kind === "protein")
    meal = {
      ...makeMeal("dinner", item.source, item.image),
      day,
      title: `${answer} dinner bowl`,
      calories: answer === "Chicken" ? 610 : 700,
      protein: answer === "Chicken" ? 49 : 46,
      note: `${answer} confirmed by you. Remaining portions are estimates.`,
    };
  if (item.kind === "fries" && answer !== "None") {
    const half = answer === "About half";
    meal = {
      id: id(),
      title: half ? "Half portion of fries" : "Side of fries",
      category: "Lunch",
      day,
      time: "12:30 PM",
      source: item.source,
      confidence: "estimated",
      calories: half ? 180 : 360,
      protein: half ? 2 : 4,
      carbs: half ? 24 : 48,
      fat: half ? 9 : 18,
      note: "Portion confirmed by you; nutrition remains estimated.",
    };
  }
  return {
    ...state,
    meals: meal ? [...state.meals, meal] : state.meals,
    reviews: state.reviews.map((r) =>
      r.id === reviewId ? { ...r, resolved: true, answer } : r,
    ),
  };
}
