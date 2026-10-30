import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { modelAnswerSchema, normalizeAnswer, runAI } from "./ai";
import { aiRequestSchema } from "../src/ai-contract";
import { requestFixture } from "../tests/ai-fixtures";

const mocks = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock("./generation.ts", () => ({
  generationAvailable: () => true,
  createGenerationClient: () => ({ responses: { parse: mocks.parse } }),
}));
const config = { openaiKey: "fixture", jevKey: "fixture", model: "fixture", jevModel: "fixture" };
const allow = { decision: "allow", allowRecords: true };
const photo = "data:image/jpeg;base64,cGxhdGU=";
const plate = modelAnswerSchema.parse({
  reply: "Here’s my estimate.",
  intent: "meal",
  items: [],
  meal: {
    title: "Salmon, rice and broccoli",
    category: "Dinner",
    portion: "About 5 oz salmon, 1 cup rice, 1 cup broccoli (visual estimate)",
    note: "Cooking oil is the biggest unknown.",
    sources: [],
    calories: 640,
    protein: 42,
    carbs: 58,
    fat: 24,
    components: null,
  },
  store: null,
  receiptNote: "",
  purchase: null,
  recipePortionProposal: null,
  preferenceProposal: null,
  suggestedAction: null,
  workout: null,
  activity: null,
  sources: [],
});
const mealCapture = () => ({
  ...requestFixture(),
  day: "2026-09-30",
  text: "Estimate this meal from my photo.",
  image: photo,
  captureIntent: "meal" as const,
});
let jevStates: Record<string, unknown>[] = [];
beforeEach(() => {
  jevStates = [];
  mocks.parse.mockReset();
  mocks.parse.mockImplementation(async (params) => ({
    status: "completed",
    output: [],
    output_parsed: params.text.format.name === "fuel_answer" ? plate : allow,
  }));
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
    jevStates.push(JSON.parse(String(init?.body)).state);
    return new Response(JSON.stringify({ answers: { record_type: { choice: "meal", confidence: 0.9 } } }));
  });
});
afterEach(() => vi.restoreAllMocks());

it("accepts only the meal camera intent on chat requests", () => {
  expect(aiRequestSchema.safeParse(mealCapture()).success).toBe(true);
  expect(aiRequestSchema.safeParse({ ...mealCapture(), captureIntent: "receipt" }).success).toBe(false);
  expect(aiRequestSchema.parse(requestFixture()).captureIntent).toBeUndefined();
});

it("tells generation and the classifier that a meal camera photo is food being eaten", async () => {
  const result = await runAI(mealCapture(), config, () => {}, new AbortController().signal);
  const [generation] = mocks.parse.mock.calls.find(([params]) => params.text.format.name === "fuel_answer")!;
  expect(JSON.parse(generation.input[0].content[0].text).captureIntent).toBe("meal");
  expect(generation.instructions).toContain("MEAL CAMERA");
  expect(jevStates[0].captureIntent).toBe("meal");
  expect(result.decision).toBe("meal");
  expect(result.meal).toMatchObject({ title: "Salmon, rice and broccoli", calories: 640 });
});

it("tells both boundary reviews that a meal camera photo requests its estimate card", async () => {
  await runAI(mealCapture(), config, () => {}, new AbortController().signal);
  const reviews = mocks.parse.mock.calls.filter(([params]) => params.text.format.name !== "fuel_answer");
  expect(reviews).toHaveLength(2);
  for (const [params] of reviews) {
    expect(JSON.parse(params.input[0].content[0].text).captureIntent).toBe("meal");
    expect(params.instructions).toContain("captureIntent meal");
  }
});

it("asks a meal camera photo about portions, never whether it was eaten", () => {
  const answer = { ...plate, intent: "uncertain" as const, meal: null, reply: "Did you eat this, or are these groceries you bought?" };
  const result = normalizeAnswer(answer, mealCapture(), new Map());
  expect(result.reply).toContain("portion");
  expect(result.reply).not.toMatch(/groceries|did you eat/i);
  expect(result.warnings).toContain("The food amount needs a check before an estimate can be proposed.");
});

it("ignores a meal intent that arrives without a photo", async () => {
  const typed = { ...mealCapture(), image: undefined, text: "What is a good snack?" };
  await runAI(typed, config, () => {}, new AbortController().signal);
  const [generation] = mocks.parse.mock.calls.find(([params]) => params.text.format.name === "fuel_answer")!;
  expect(JSON.parse(generation.input[0].content[0].text).captureIntent).toBeUndefined();
  expect(jevStates[0].captureIntent).toBeUndefined();
  for (const [params] of mocks.parse.mock.calls.filter(([params]) => params.text.format.name !== "fuel_answer"))
    expect(JSON.parse(params.input[0].content[0].text).captureIntent).toBeUndefined();
  const question = normalizeAnswer({ ...plate, intent: "uncertain", meal: null, reply: "Is this a meal or groceries?" }, typed, new Map());
  expect(question.reply).toBe("Is this a meal or groceries?");
});
