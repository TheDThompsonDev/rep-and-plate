import { describe, it, expect, vi, afterEach } from "vitest";
import { initialState, sumNutrition, stateSchema } from "./domain";
import { addProposedMeal, applyAIResult, buildAIRequest, resolvePreferenceProposal, retainComposerDraft, markCaptureStopped, requestAI, STOPPED_CAPTURE_MESSAGE } from "./ai-client";
import { aiRequestSchema, safeUrl } from "./ai-contract";
import { requestFixture, resultFixture } from "../tests/ai-fixtures";
function stateWithRequest() {
  const state = initialState();
  const id = crypto.randomUUID();
  state.messages.push({
    id,
    role: "user",
    text: "My groceries",
    ai: true,
    aiStatus: "pending",
    time: "12:00 PM",
  });
  return { state, id };
}
describe("AI record transitions", () => {
  it("stores grocery purchases without affecting intake; replay is idempotent", () => {
    const { state, id } = stateWithRequest();
    const result = resultFixture(id);
    const next = applyAIResult(state, result);
    expect(next.groceries).toHaveLength(1);
    expect(sumNutrition(next.meals)).toEqual(sumNutrition(state.meals));
    expect(applyAIResult(next, result)).toEqual(next);
    expect(stateSchema.parse(next).groceries).toHaveLength(1);
  });
  it("deduplicates a reuploaded receipt and preserves edited items", () => {
    const { state, id } = stateWithRequest();
    let next = applyAIResult(state, resultFixture(id));
    next.groceries![0].items[0].name = "My corrected milk";
    const second = crypto.randomUUID();
    next.messages.push({
      id: second,
      role: "user",
      text: "Same receipt",
      time: "12:01 PM",
    });
    next = applyAIResult(next, resultFixture(second));
    expect(next.groceries).toHaveLength(1);
    expect(next.groceries![0].items[0].name).toBe("My corrected milk");
    expect(next.messages.at(-1)?.receiptId).toBe(id);
  });
  it("does not resurrect captures after reset", () => {
    expect(
      applyAIResult(initialState(), resultFixture(crypto.randomUUID()))
        .groceries,
    ).toBeUndefined();
  });
  it("adds a proposed drink only once when accepted", () => {
    const { state, id } = stateWithRequest();
    const result = {
      ...resultFixture(id),
      decision: "meal" as const,
      receipt: null,
      meal: {
        title: "Chai with whole milk",
        category: "Snack" as const,
        portion: "1 cup",
        note: "Milk and sweetener included.",
        calories: 180,
        protein: 6,
        carbs: 22,
        fat: 7,
        sources: [],
      },
    };
    const proposed = applyAIResult(state, result);
    expect(proposed.meals).toHaveLength(state.meals.length);
    const saved = addProposedMeal(proposed, `answer-${id}`);
    expect(saved.meals.at(-1)?.calories).toBe(180);
    expect(saved.meals.at(-1)?.image).toBeUndefined();
    expect(addProposedMeal(saved, `answer-${id}`).meals).toHaveLength(
      saved.meals.length,
    );
  });
  it("keeps the meal camera photo on the estimate it produced", () => {
    const { state, id } = stateWithRequest();
    const photo = "data:image/jpeg;base64,cGxhdGU=";
    state.messages[state.messages.length - 1] = { ...state.messages.at(-1)!, image: photo, captureIntent: "meal" };
    const meal = { title: "Salmon bowl", category: "Dinner" as const, portion: "1 bowl", note: "Visual estimate.", calories: 640, protein: 42, carbs: 58, fat: 24, sources: [] };
    const proposed = applyAIResult(state, { ...resultFixture(id), decision: "meal", receipt: null, meal });
    const saved = addProposedMeal(proposed, `answer-${id}`);
    expect(saved.meals.at(-1)).toMatchObject({ title: "Salmon bowl", image: photo });
    expect(stateSchema.parse(saved).meals.at(-1)?.image).toBe(photo);
  });
  it("forwards only the meal camera intent with its photo", () => {
    const { state } = stateWithRequest();
    const capture = { ...state.messages.at(-1)!, image: "data:image/jpeg;base64,cGxhdGU=", captureIntent: "meal" as const };
    expect(aiRequestSchema.parse(buildAIRequest(state, capture)).captureIntent).toBe("meal");
    expect(buildAIRequest(state, { ...capture, captureIntent: "receipt" }).captureIntent).toBeUndefined();
    expect(buildAIRequest(state, { ...capture, image: undefined }).captureIntent).toBeUndefined();
  });
  it("saves the reviewed breakdown once without consuming pantry stock", () => {
    const {state,id}=stateWithRequest();
    const components=[{name:"Whole milk",portion:"1 cup",nutrition:{calories:150,protein:8,carbs:12,fat:8}},{name:"Syrup",portion:"1 tbsp",nutrition:{calories:50,protein:0,carbs:13,fat:0}}];
    const result={...resultFixture(id),decision:"meal" as const,receipt:null,meal:{title:"Chai",category:"Snack" as const,portion:"1 mug",note:"Includes milk and syrup.",sources:[],calories:1,protein:1,carbs:1,fat:1,components}};
    const proposed=applyAIResult(state,result);
    expect(proposed.meals).toEqual(state.meals);
    const saved=addProposedMeal(proposed,`answer-${id}`);
    expect(saved.meals.at(-1)).toMatchObject({calories:200,protein:8,carbs:25,fat:8,components:components.map(component=>({name:component.name,servings:1,servingLabel:component.portion,nutrition:component.nutrition}))});
    expect(saved.meals.at(-1)?.components?.every(component=>!component.lotId)).toBe(true);
    expect(saved.pantryEvents).toEqual(state.pantryEvents);
    expect(stateSchema.parse(saved).meals.at(-1)?.components).toHaveLength(2);
    expect(addProposedMeal(saved,`answer-${id}`)).toBe(saved);
  });
  it("sends bounded AI history and excludes used groceries and sample chat", () => {
    const { state, id } = stateWithRequest();
    const next = applyAIResult(state, resultFixture(id));
    next.groceries![0].items[0].availability = "used";
    const message = {
      id: crypto.randomUUID(),
      role: "user" as const,
      text: "Dinner ideas?",
      time: "now",
    };
    const req = buildAIRequest(next, message);
    expect(
      req.history.every((m) => !m.text.includes("grilled chicken breast")),
    ).toBe(true);
    expect(req.context.groceries[0].items.map((i) => i.name)).toEqual(["Oats"]);
    expect(JSON.stringify(req)).not.toContain("OPENAI_API_KEY");
  });
  it("rejects executable links and local endpoints", () => {
    expect(safeUrl("javascript:alert(1)")).toBe(false);
    expect(safeUrl("https://127.0.0.1/secrets")).toBe(false);
    expect(safeUrl("https://user:password@example.com")).toBe(false);
    expect(safeUrl("https://www.kroger.com/product")).toBe(true);
  });
});


describe("preference confirmation lifecycle",()=>{
 it("persists a proposal without applying it, then accepts once without duplicate values",()=>{
  const {state,id}=stateWithRequest();const result={...resultFixture(id),receipt:null,decision:"conversation" as const,preferenceProposal:{evidence:"I dislike mushrooms",description:"Skip mushrooms",changes:[{field:"dislikes" as const,operation:"add" as const,value:"mushrooms"}]}};
  const proposed=applyAIResult(state,result);expect(proposed.preferences).toEqual(state.preferences);const messageId=proposed.messages.at(-1)!.id;
  const accepted=resolvePreferenceProposal(proposed,messageId,true);expect(accepted.preferences?.dislikes).toEqual(["mushrooms"]);expect(resolvePreferenceProposal(accepted,messageId,true)).toBe(accepted);expect(stateSchema.parse(accepted).messages.at(-1)?.preferenceStatus).toBe("accepted");
  const dismissed=resolvePreferenceProposal(proposed,messageId,false);expect(dismissed.preferences).toEqual(state.preferences);expect(resolvePreferenceProposal(dismissed,messageId,true)).toBe(dismissed);
 });
});
describe("composer retention and stop helpers", () => {
  it("keeps an incoming preset or transcript while a reply is processing", () => {
    expect(retainComposerDraft("", "How am I doing today?")).toBe("How am I doing today?");
    expect(retainComposerDraft("   ", "Start my workout")).toBe("Start my workout");
    expect(retainComposerDraft("two eggs", "two eggs")).toBe("two eggs");
    expect(retainComposerDraft("two eggs", "and toast")).toBe("two eggs and toast");
  });
  it("marks only the pending capture as stopped with a retryable error", () => {
    const { state, id } = stateWithRequest();
    const next = markCaptureStopped(state, id);
    const message = next.messages.find((m) => m.id === id)!;
    expect(message.aiStatus).toBe("error");
    expect(message.aiError).toBe(STOPPED_CAPTURE_MESSAGE);
    const done = applyAIResult(state, resultFixture(id));
    expect(markCaptureStopped(done, id)).toBe(done);
    expect(markCaptureStopped(state, "missing")).toBe(state);
  });
});
describe("requestAI transport guards", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("rejects when the caller aborts instead of resolving a later result", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
        }),
    );
    const pending = requestAI(requestFixture(), () => {}, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
  it("rejects a result whose request id does not match this capture", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          JSON.stringify({ type: "result", result: resultFixture(crypto.randomUUID()) }) + "\n",
          { status: 200, headers: { "Content-Type": "application/x-ndjson" } },
        ),
    );
    await expect(requestAI(requestFixture(), () => {})).rejects.toThrow("did not match this capture");
  });
});
