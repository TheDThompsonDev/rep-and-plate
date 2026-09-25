import { aiResultSchema, type AIRequest, type AIResult } from "./ai-contract";
import {
  clockTime,
  sumNutrition,
  today,
  type AppState,
  type Message,
} from "./domain";

export function buildAIRequest(state: AppState, message: Message): AIRequest {
  const index = state.messages.findIndex((m) => m.id === message.id);
  const previous = index < 0 ? state.messages : state.messages.slice(0, index);
  return {
    requestId: message.id,
    text: message.text,
    image: message.image?.startsWith("data:") ? message.image : undefined,
    day: today(),
    history: previous
      .filter((m) => m.ai && m.aiStatus !== "error" && m.aiStatus !== "pending")
      .slice(-12)
      .map((m) => ({ role: m.role, text: m.text.slice(0, 18000) })),
    context: {
      goals: {
        calories: state.profile.calories,
        protein: state.profile.protein,
        carbs: state.profile.carbs,
        fat: state.profile.fat,
      },
      totals: sumNutrition(state.meals),
      meals: state.meals
        .filter((m) => m.day === today())
        .slice(-30)
        .map(({ title, category, calories, protein, carbs, fat }) => ({
          title,
          category,
          calories,
          protein,
          carbs,
          fat,
        })),
      groceries: (state.groceries ?? [])
        .slice(-5)
        .map(({ store, items }) => ({
          store,
          items: items.filter((item) => item.availability === "available"),
        })),
      workout: JSON.stringify({
        status: state.workout.status,
        title: state.workout.title ?? "Upper Body",
        exercises: state.workout.exercises,
      }).slice(0, 3000),
    },
  };
}
export function applyAIResult(state: AppState, result: AIResult): AppState {
  if (
    state.messages.some(
      (m) => m.role === "assistant" && m.requestId === result.requestId,
    )
  )
    return state;
  // A reset or removed source message must not be repopulated by an old response.
  if (!state.messages.some((m) => m.id === result.requestId)) return state;
  const previous = (state.groceries ?? []).find(
    (g) => g.fingerprint === result.receipt?.fingerprint,
  );
  const receipt = previous ?? result.receipt;
  return {
    ...state,
    groceries:
      result.receipt && !previous
        ? [...(state.groceries ?? []), result.receipt]
        : state.groceries,
    messages: [
      ...state.messages.map((m) =>
        m.id === result.requestId
          ? { ...m, aiStatus: "complete" as const, aiError: undefined }
          : m,
      ),
      {
        id: `answer-${result.requestId}`,
        requestId: result.requestId,
        role: "assistant",
        text: previous
          ? "This receipt is already in your groceries. I’ve kept your saved items and edits."
          : result.reply,
        time: clockTime(),
        ai: true,
        aiStatus: "complete",
        receiptId: receipt?.id,
        mealProposal: result.meal ?? undefined,
        sources: result.sources,
        warnings: result.warnings,
      },
    ],
  };
}
export function addProposedMeal(state: AppState, messageId: string): AppState {
  const message = state.messages.find((m) => m.id === messageId);
  const meal = message?.mealProposal;
  if (!message || !meal || message.mealId) return state;
  const mealId = `ai-meal-${messageId}`;
  return {
    ...state,
    meals: [
      ...state.meals,
      {
        id: mealId,
        title: meal.title,
        category: meal.category,
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fat: meal.fat,
        day: today(),
        time: clockTime(),
        source: "AI estimate · checked by you",
        confidence: "estimated",
        note: `${meal.portion}. ${meal.note}`,
      },
    ],
    messages: state.messages.map((m) =>
      m.id === messageId ? { ...m, mealId, mealProposal: undefined } : m,
    ),
  };
}
export async function requestAI(
  request: AIRequest,
  onProgress: (text: string) => void,
): Promise<AIResult> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(185000),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      body.error ?? "Fuel couldn’t complete that request. Please try again.",
    );
  }
  if (!response.body)
    throw new Error("The connection ended before a response arrived.");
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = "";
  let result: AIResult | undefined;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let end: number;
      while ((end = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        if (event.type === "progress" && typeof event.text === "string")
          onProgress(event.text);
        if (event.type === "error") throw new Error(event.error);
        if (event.type === "result")
          result = aiResultSchema.parse(event.result);
      }
    }
  } finally {
    reader.releaseLock();
  }
  if (!result)
    throw new Error(
      "The connection ended before a complete answer arrived. You can retry this capture.",
    );
  if (result.requestId !== request.requestId)
    throw new Error("That response did not match this capture. Please retry.");
  return result;
}
