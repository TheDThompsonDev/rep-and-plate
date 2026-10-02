/** Static teaching content only. Never pass these examples to capture or persistence. */
export const interactionTitle = "Here’s what you can do with me.";
export const interactionInstructions =
  "Type, talk, or share a photo. Include amounts when you can. You review before anything is logged.";
export const interactionAccess =
  "AI estimates, receipt reading and voice need a connected, approved account during private preview. Manual food and workout tracking work on this device.";
export const interactionExamples = [
  {
    id: "meal",
    label: "Meal",
    input: "I ate 2 eggs and a slice of toast.",
    payoff: "Estimated calories & macros",
    detail: "Review, then log to see it in today’s calorie & macro totals.",
    preview: [
      "2 eggs · 1 slice of toast",
      "Illustrative estimate · ~225 kcal",
      "16 g protein · 15 g carbs · 11 g fat",
    ],
    review:
      "Estimates depend on portions and preparation. You can edit them before logging.",
  },
  {
    id: "workout",
    label: "Workout",
    input: "Bench press: 3×8 at 135 lb.",
    payoff: "Review sets & weight",
    detail: "Review, then save to your training history.",
    preview: ["Bench press", "3 sets × 8 reps · 135 lb"],
    review:
      "Check the date, reps and weight before saving your actual workout.",
  },
  {
    id: "receipt",
    label: "Receipt",
    input: "Share a photo of a grocery receipt.",
    payoff: "Groceries ready for later logging",
    detail:
      "Check the foods you bought. Keep them handy in your pantry for logging portions you actually eat later.",
    preview: ["Eggs · Greek yogurt · Oats", "Check each product and quantity."],
    review:
      "Purchases never count as food eaten. Log a portion separately when you eat it.",
  },
] as const;
