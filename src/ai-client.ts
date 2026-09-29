import { apiFetch } from "./api-fetch";
import { aiResultSchema, aiNutritionSchema, type AIRequest, type AIResult } from "./ai-contract";
import { applyPreferenceProposal } from "./features/preferences/proposals";
import { defaultPreferences } from "./features/preferences/contracts";
import { receiptSpending } from './features/shopping/shopping';
import { getPantryLots } from "./features/pantry/ledger";
import { remainingRecipePortions } from "./features/recipes/portions";
import { normalizeProposalComponents, sumProposalComponents } from "./features/meals/proposals";
import {
  clockTime,
  sumNutrition,
  personalMeals,
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
      shopping: (()=>{const spending=receiptSpending(state.groceries??[]);return {totals:spending.totals,recordedReceipts:state.groceries?.length??0,reviewedReceipts:spending.covered,missingOrUncheckedTotals:spending.unpriced,list:(state.shopping?.list??[]).slice(-50).map(({name,quantity,checked})=>({name,quantity,checked}))};})(),
      preparedRecipes: (state.recipeBatches ?? [])
        .filter(batch => !batch.undoneAt && remainingRecipePortions(batch) > 0)
        .slice(-30)
        .flatMap(batch => {
          const nutrition = aiNutritionSchema.safeParse(Object.fromEntries(Object.entries(batch.nutrition).map(([key,value])=>[key,Math.round(value / batch.totalPortions * 100) / 100])));
          return nutrition.success ? [{id: batch.id.slice(0,200), name: batch.name, preparedAt: batch.createdAt.slice(0,40), remainingPortions: remainingRecipePortions(batch), nutritionPerPortion:nutrition.data}] : [];
        }),
      preferences: state.preferences,
      goals: {
        calories: state.profile.calories,
        protein: state.profile.protein,
        carbs: state.profile.carbs,
        fat: state.profile.fat,
      },
      totals: sumNutrition(state.meals),
      meals: personalMeals(state.meals, today())
        .slice(-30)
        .map(({ title, category, calories, protein, carbs, fat }) => ({
          title,
          category,
          calories,
          protein,
          carbs,
          fat,
        })),
      groceries: (() => {
        const groups = new Map<
          string,
          {
            store: string;
            items: AIRequest["context"]["groceries"][number]["items"];
          }
        >();
        const lots = getPantryLots(state).filter(
          (lot) =>
            lot.item.availability === "available" &&
            (lot.remaining === null || lot.remaining > 0),
        );
        // Include useful available items from the whole pantry, not just the newest receipts.
        for (const lot of lots.slice(0, 150)) {
          const bucket = Math.floor(
            [...groups.values()].reduce((n, g) => n + g.items.length, 0) / 30,
          );
          const key = String(bucket);
          if (!groups.has(key))
            groups.set(key, {
              store: "Available pantry ingredients",
              items: [],
            });
          groups
            .get(key)!
            .items.push({
              ...lot.item,
              productCandidates: undefined,
              price: undefined,
              servingsPurchased: lot.remaining,
              quantity:
                lot.remaining === null
                  ? lot.item.quantity
                  : `${lot.remaining} labeled servings remaining`,
              note: `${lot.item.note} Bought at ${lot.store} on ${lot.date}.`.slice(
                0,
                1200,
              ),
            });
        }
        return [...groups.values()];
      })(),
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
        spotCheck: result.decision === 'uncertain',
        workoutProposal: result.workout ?? undefined,
        workoutCaptureStatus: result.workout ? 'pending' : undefined,
        receiptId: receipt?.id,
        mealProposal: result.meal ?? undefined,
        preferenceProposal: result.preferenceProposal ?? undefined,
        preferenceStatus: result.preferenceProposal ? "pending" : undefined,
        suggestedAction: result.suggestedAction ?? undefined,
        recipePortionProposal: result.recipePortionProposal ?? undefined,
        recipePortionProposalStatus: result.recipePortionProposal ? "pending" : undefined,
        sources: result.sources,
        warnings: result.warnings,
      },
    ],
  };
}
export function resolvePreferenceProposal(state: AppState, messageId: string, accept: boolean): AppState {
  const message=state.messages.find(entry=>entry.id===messageId);
  if (!message?.preferenceProposal || message.preferenceStatus !== "pending") return state;
  const preferences=accept ? applyPreferenceProposal(state.preferences ?? defaultPreferences(),message.preferenceProposal) : state.preferences;
  return {...state,preferences,messages:state.messages.map(entry=>entry.id===messageId ? {...entry,preferenceStatus:accept ? "accepted" as const : "dismissed" as const} : entry)};
}
export function addProposedMeal(state: AppState, messageId: string): AppState {
  const message = state.messages.find((m) => m.id === messageId);
  const meal = message?.mealProposal;
  if (!message || !meal || message.mealId) return state;
  const mealId = `ai-meal-${messageId}`;
  const totals = meal.components ? sumProposalComponents(meal.components) : meal;
  return {
    ...state,
    meals: [
      ...state.meals,
      {
        id: mealId,
        title: meal.title,
        category: meal.category,
        calories: totals.calories,
        protein: totals.protein,
        carbs: totals.carbs,
        fat: totals.fat,
        components: meal.components ? normalizeProposalComponents(meal.components, mealId) : undefined,
        day: meal.day ?? today(),
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
  signal?: AbortSignal,
): Promise<AIResult> {
  const response = await apiFetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(185000)]) : AbortSignal.timeout(185000),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      body.error ?? "Rep & Plate couldn’t complete that request. Please try again.",
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
