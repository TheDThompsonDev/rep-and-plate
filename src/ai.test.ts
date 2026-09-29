import { describe, it, expect } from "vitest";
import { initialState, sumNutrition, stateSchema } from "./domain";
import { addProposedMeal, applyAIResult, buildAIRequest, resolvePreferenceProposal } from "./ai-client";
import { safeUrl } from "./ai-contract";
import { resultFixture } from "../tests/ai-fixtures";
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
    expect(addProposedMeal(saved, `answer-${id}`).meals).toHaveLength(
      saved.meals.length,
    );
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
