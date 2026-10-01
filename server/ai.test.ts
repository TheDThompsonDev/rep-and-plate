import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer, request as httpRequest } from "node:http";
import {
  collectSources,
  modelAnswerSchema,
  providerAnswerSchema,
  normalizeAnswer,
  checkIntent,
} from "./ai";
import { zodTextFormat } from 'openai/helpers/zod';
import { createApi, publicError, readConfig } from "./http";
import { requestFixture, resultFixture } from "../tests/ai-fixtures";
const config = {
  openaiKey: "test-key-not-real",
  jevKey: "test-jev-not-real",
  model: "gpt-5-mini",
  jevModel: "jev-latest",
};
function modelFixture() {
  const r = resultFixture(crypto.randomUUID());
  return modelAnswerSchema.parse({
    preferenceProposal: null,
    suggestedAction: null,
    recipePortionProposal: null,
    reply: r.reply,
    intent: "grocery",
    store: "Kroger",
    receiptNote: "",
    purchase: null,
    items: r.receipt!.items.map(item=>({...item,price:null})),
    meal: null,
    sources: r.sources,
  });
}
afterEach(() => vi.restoreAllMocks());
describe("AI grounding and boundaries", () => {
  it('keeps an uncertain follow-up footer neutral instead of questioning established meal intent',()=>{
    const answer={...modelFixture(),items:[],intent:'uncertain' as const,reply:'We can use a common serving for review, or keep a note. Which would you prefer?'};
    const result=normalizeAnswer(answer,{...requestFixture(),text:'I already ate it and cannot remember how much.',history:[{role:'user',text:'I ate peanut butter for breakfast.'},{role:'assistant',text:'How much peanut butter?'}]},new Map());
    expect(result.warnings.join(' ')).not.toMatch(/meal or a grocery|whether.*meal/);
    expect(result.reply).toContain('Which would you prefer');
  });
  it('provides a strict nullable activity field to providers while legacy answers remain readable',()=>{
    const legacy=modelFixture();
    expect(modelAnswerSchema.safeParse(legacy).success).toBe(true);
    const format=zodTextFormat(providerAnswerSchema,'capture');
    expect(format.strict).toBe(true);
    const schema=format.schema as {required:string[];properties:Record<string,{anyOf:{required?:string[]}[]}>};
    expect(schema.required).toContain('activity');
    expect(schema.properties.activity.anyOf.find(option=>option.required)?.required).toEqual(['title','day','minutes','note']);
    expect(providerAnswerSchema.safeParse({...legacy,workout:null,activity:null}).success).toBe(true);
  });
  it('uses the normalized nutrition totals in prose as well as the review card',()=>{
    const answer={...modelFixture(),intent:'meal' as const,items:[],reply:'Your meal has 23 g protein, 34 g carbs and 1 g fat.',meal:{title:'Yogurt',category:'Breakfast' as const,portion:'one bowl',note:'',sources:[],calories:220,protein:23,carbs:34,fat:1,components:[{name:'Yogurt',portion:'one bowl',nutrition:{calories:215,protein:18.3,carbs:33,fat:0.4}}]}};
    const result=normalizeAnswer(answer,requestFixture(),new Map());
    expect(result.reply).toContain('18.3 g protein');
    expect(result.reply).toContain('0.4 g fat');
    expect(result.reply).not.toContain('23 g protein');
  });
  it('keeps an explicit consumed-food clarification about portions',()=>{
    const answer={...modelFixture(),items:[],intent:'uncertain' as const,reply:'Is this a meal or groceries?'};
    const result=normalizeAnswer(answer,{...requestFixture(),text:'I ate peanut butter for breakfast'},new Map());
    expect(result.reply).toContain('portion');
    expect(result.reply).not.toContain('groceries');
  });
  it('holds a model-invented portion when typed consumption gives no amount',()=>{
    const meal={title:'Peanut butter',category:'Breakfast' as const,portion:'1 tablespoon',note:'Estimated serving',sources:[],calories:95,protein:3.5,carbs:3,fat:8,components:null};
    const answer={...modelFixture(),intent:'meal' as const,items:[],meal};
    const result=normalizeAnswer(answer,{...requestFixture(),text:'I ate peanut butter for breakfast.'},new Map());
    expect(result.meal).toBeNull();
    expect(result.reply).toContain('portion');
    expect(result.reply).not.toContain('groceries');
    expect(normalizeAnswer(answer,{...requestFixture(),text:'I ate 1 tablespoon of peanut butter for breakfast.'},new Map()).meal).not.toBeNull();
  });
  it('uses the selected diary day for an undated meal while retaining an explicit date',()=>{
    const request={...requestFixture(),day:'2026-09-30',captureDay:'2026-09-20'};
    const meal={title:'Toast',category:'Breakfast' as const,portion:'1 slice',note:'',sources:[],calories:100,protein:3,carbs:20,fat:1,components:null};
    const answer={...modelFixture(),intent:'meal' as const,items:[],meal};
    expect(normalizeAnswer(answer,request,new Map()).meal?.day).toBe('2026-09-20');
    expect(normalizeAnswer({...answer,meal:{...meal,day:request.day}},request,new Map()).meal?.day).toBe('2026-09-20');
    expect(normalizeAnswer({...answer,meal:{...meal,day:'2026-09-29'}},{...request,text:'I ate one slice of toast yesterday'},new Map()).meal?.day).toBe('2026-09-29');
    expect(normalizeAnswer(answer,{...request,captureDay:'2026-02-31'},new Map()).meal).toBeNull();
  });
  it('proposes a timed walk without inventing sets, calories or an already-saved result',()=>{
    const activity={title:'Walk',minutes:20,day:'2026-09-20',note:''};
    const answer={...modelFixture(),intent:'conversation' as const,items:[],activity,suggestedAction:'workout' as const};
    const result=normalizeAnswer(answer,{...requestFixture(),day:'2026-09-30'},new Map());
    expect(result.activity).toEqual(activity);
    expect(result.workout).toBeNull();
    expect(result.meal).toBeNull();
    expect(result.suggestedAction).toBeNull();
    expect(result.reply).toContain('before saving');
    expect(normalizeAnswer({...answer,activity:{...activity,day:'2026-09-30'}},{...requestFixture(),day:'2026-09-30',captureDay:'2026-09-20',text:'I walked for 20 minutes'},new Map()).activity?.day).toBe('2026-09-20');
    expect(normalizeAnswer({...answer,activity:{...activity,day:'2026-02-31'}},requestFixture(),new Map()).activity).toBeNull();
  });
  it('retains an explicit date for a bounded portion clarification but not a new independent capture',()=>{
    const meal={title:'Peanut butter',category:'Breakfast' as const,portion:'2 tablespoons',note:'',sources:[],calories:190,protein:8,carbs:7,fat:16,components:null,day:'2026-09-29'};
    const answer={...modelFixture(),intent:'meal' as const,items:[],meal};
    const request={...requestFixture(),day:'2026-09-30',captureDay:'2026-09-20',text:'2 tablespoons',history:[{role:'user' as const,text:'Yesterday I ate peanut butter.'},{role:'assistant' as const,text:'How much peanut butter did you eat?'}]};
    expect(normalizeAnswer(answer,request,new Map()).meal?.day).toBe('2026-09-29');
    expect(normalizeAnswer({...answer,meal:{...meal,title:'Apple',day:'2026-09-30'}},{...request,text:'I ate one apple.'},new Map()).meal?.day).toBe('2026-09-20');
    expect(normalizeAnswer(answer,{...request,history:[request.history[0],{role:'assistant',text:'Check your saved meal card.'}]},new Map()).meal?.day).toBe('2026-09-20');
  });
  it('retains receipt prices as unconfirmed evidence and never substitutes upload date for purchase date',()=>{
    const answer=modelFixture();
    answer.purchase={purchaseDate:'2026-09-20',currency:'CAD',subtotal:10,tax:1,discount:null,total:11};
    answer.items[0].price={total:4,discount:1};
    const result=normalizeAnswer(answer,requestFixture(),new Map());
    expect(result.receipt?.purchase).toEqual({...answer.purchase,confirmed:false});
    expect(result.receipt?.items[0].price).toEqual({total:4,discount:1});
    expect(result.meal).toBeNull();
    answer.purchase={purchaseDate:null,currency:null,subtotal:null,tax:null,discount:null,total:null};
    expect(normalizeAnswer(answer,requestFixture(),new Map()).receipt?.purchase?.purchaseDate).toBeNull();
  });
  it("grounds prepared portions in current text and saved leftovers without a duplicate meal estimate", () => {
    const request = {...requestFixture(), text:"I ate 1.5 portions of my overnight oats for breakfast."};
    request.context.preparedRecipes = [{id:"batch-oats",name:"Overnight oats",preparedAt:"2026-09-25T08:00:00.000Z",remainingPortions:3,nutritionPerPortion:{calories:225,protein:9,carbs:33,fat:7}}];
    const proposal = {batchId:"batch-oats",portions:1.5,category:"Breakfast" as const,evidence:request.text};
    const answer = {...modelFixture(),intent:"meal" as const,items:[],recipePortionProposal:proposal,suggestedAction:"recipes" as const,meal:{title:"Oats",category:"Breakfast" as const,portion:"1.5 portions",note:"",calories:999,protein:99,carbs:99,fat:99,sources:[],components:null}};
    const result=normalizeAnswer(answer,request,new Map());
    expect(result.recipePortionProposal).toEqual(proposal);
    expect(result.meal).toBeNull();
    expect(result.suggestedAction).toBeNull();
    for(const invalid of [{...proposal,batchId:"unknown"},{...proposal,portions:4},{...proposal,evidence:"I ate a different meal."}]) {
      const held=normalizeAnswer({...answer,recipePortionProposal:invalid},request,new Map());
      expect(held.recipePortionProposal).toBeNull();
      expect(held.meal).toBeNull();
      expect(held.warnings.join(' ')).toContain("leftovers");
    }
    expect(normalizeAnswer(answer,{...request,image:"data:image/png;base64,AAAA"},new Map()).recipePortionProposal).toBeNull();
    expect(normalizeAnswer(answer,request,new Map(),{choice:"grocery",confidence:0.99}).recipePortionProposal).toBeNull();
  });
  it("sums complete meal components and blocks an oversized combined estimate", () => {
    const answer = {...modelFixture(), intent:"meal" as const, items:[], meal:{
      title:"Chai and eggs", category:"Breakfast" as const, portion:"One breakfast", note:"Milk, syrup and oil included.", sources:[],
      calories:999, protein:999, carbs:999, fat:999,
      components:[
        {name:"Whole milk",portion:"1 cup",nutrition:{calories:150,protein:8,carbs:12,fat:8}},
        {name:"Syrup",portion:"1 tbsp",nutrition:{calories:50,protein:0,carbs:13,fat:0}},
        {name:"Olive oil",portion:"1 tsp",nutrition:{calories:40,protein:0,carbs:0,fat:4.5}},
        {name:"Eggs",portion:"2 eggs",nutrition:{calories:140,protein:12,carbs:1,fat:10}},
      ],
    }};
    const result = normalizeAnswer(answer,requestFixture(),new Map());
    expect(result.meal).toMatchObject({calories:380,protein:20,carbs:26,fat:22.5});
    expect(result.meal?.components).toHaveLength(4);
    answer.meal.components = [0,1].map(()=>({name:"Very large portion",portion:"Check quantity",nutrition:{calories:15000,protein:1,carbs:1,fat:1}}));
    const blocked = normalizeAnswer(answer,requestFixture(),new Map());
    expect(blocked.meal).toBeNull();
    expect(blocked.warnings.join(' ')).toContain('portions');
  });
  it("only passes known read-only tool suggestions for conversational replies", () => {
    const answer = {...modelFixture(), intent: "conversation" as const, suggestedAction: "recipes" as const};
    expect(normalizeAnswer(answer, requestFixture(), new Map()).suggestedAction).toBe("recipes");
    expect(normalizeAnswer({...answer, intent:"grocery"}, requestFixture(), new Map()).suggestedAction).toBeNull();
    expect(normalizeAnswer({...answer, intent:"meal", meal:null}, requestFixture(), new Map()).suggestedAction).toBe("recipes");
    expect(modelAnswerSchema.safeParse({...answer, suggestedAction:"delete-meals"}).success).toBe(false);
  });
  it("does not accept a model-invented URL as retrieval evidence", () => {
    const answer = modelFixture();
    const result = normalizeAnswer(
      answer,
      requestFixture(),
      collectSources({
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify(answer),
                annotations: [],
              },
            ],
          },
        ],
      }),
    );
    expect(result.receipt?.items[0].nutrition).toBeNull();
    expect(result.receipt?.items[0].match).toBe("unresolved");
    expect(result.sources).toEqual([]);
  });
  it("retains per-serving nutrition only with a retrieved source; leaves unknown values blank", () => {
    const answer = modelFixture();
    const retrieved = collectSources({
      output: [
        { type: "web_search_call", action: { sources: answer.sources } },
      ],
    });
    const result = normalizeAnswer(answer, requestFixture(), retrieved);
    expect(result.receipt?.items[0].nutrition?.calories).toBe(150);
    expect(result.receipt?.items[1].nutrition).toBeNull();
    expect(result.receipt?.items[1].servingsPurchased).toBeNull();
  });
  it("holds records when JEV disagrees; groceries cannot also create a meal", () => {
    const answer = modelFixture();
    answer.meal = {
      components: null,
      ...resultFixture("x").receipt!.items[0].nutrition!,
      title: "Milk",
      category: "Snack",
      portion: "1 cup",
      note: "",
      sources: [],
    };
    expect(
      normalizeAnswer(answer, requestFixture(), new Map()).meal,
    ).toBeNull();
    const held = normalizeAnswer(answer, requestFixture(), new Map(), {
      choice: "conversation",
      confidence: 0.9,
    });
    expect(held.receipt).toBeNull();
    expect(held.meal).toBeNull();
    expect(held.decision).toBe("conversation");
    expect(held.warnings).toEqual([]);
    const conflicting = normalizeAnswer(answer, requestFixture(), new Map(), {
      choice: "meal",
      confidence: 0.9,
    });
    expect(conflicting.decision).toBe("uncertain");
    expect(conflicting.receipt).toBeNull();
    expect(conflicting.meal).toBeNull();
  });
  it("discloses receipt truncation instead of silently dropping lines", () => {
    const answer = modelFixture();
    answer.items = Array.from({ length: 41 }, () => answer.items[0]);
    const result = normalizeAnswer(answer, requestFixture(), new Map());
    expect(result.receipt?.items).toHaveLength(40);
    expect(result.receipt?.note).toContain(
      "Only the first 40 items were saved",
    );
  });
  it("calls only the official JEV endpoint and validates its decision", async () => {
    const mocked = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          answers: { record_type: { choice: "grocery", confidence: 0.9 } },
        }),
        { status: 200 },
      ),
    );
    expect(
      await checkIntent(
        config,
        { currentMessage: "I bought milk" },
        new AbortController().signal,
      ),
    ).toEqual({ choice: "grocery", confidence: 0.9 });
    expect(mocked.mock.calls[0][0]).toBe(
      "https://api.typesafe.ai/v1/systemone",
    );
  });
  it("never sends raw upstream errors or credentials to the browser", () => {
    expect(
      publicError({ message: "SECRET_KEY in request body" }),
    ).not.toContain("SECRET_KEY");
    expect(publicError({ status: 401, message: "secret" })).toContain(
      "authenticate",
    );
  });
});
describe("HTTP API", () => {
  it("validates origin/body and deduplicates a completed request without a second provider call", async () => {
    const runner = vi.fn(async (req) => resultFixture(req.requestId));
    const api = createApi(config, runner);
    const server = createServer((req, res) => {
      void api(req, res, () => res.writeHead(404).end());
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const address = server.address() as { port: number };
    const url = `http://127.0.0.1:${address.port}`;
    try {
      const status = await fetch(url + "/api/status").then((r) => r.text());
      expect(status).not.toContain("test-key");
      const bad = await fetch(url + "/api/chat", {
        method: "POST",
        headers: {
          Origin: "https://attacker.example",
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      expect(bad.status).toBe(403);
      const invalid = await fetch(url + "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      expect(invalid.status).toBe(400);
      const req = requestFixture();
      const post = () =>
        fetch(url + "/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(req),
        }).then((r) => r.text());
      expect(await post()).toContain('"type":"result"');
      expect(await post()).toContain('"type":"result"');
      expect(runner).toHaveBeenCalledTimes(1);
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });
});

describe("local API and cloud configuration boundary", () => {
  it("exposes only the publishable configuration and rejects foreign hosts", async () => {
    const settings = readConfig({
      SUPABASE_URL: "https://fixture.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_browser_fixture",
      SUPABASE_SECRET_KEY: "private-secret",
      SUPABASE_SERVICE_ROLE_KEY: "private-role",
      OPENAI_API_KEY: "private-ai",
    });
    const api = createApi(settings);
    const server = createServer((req, res) => {
      void api(req, res, () => res.writeHead(404).end());
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const { port } = server.address() as { port: number };
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/cloud/config`);
      const config = await response.json();
      expect(config).toEqual({
        available: true,
        url: "https://fixture.supabase.co",
        publishableKey: "sb_publishable_browser_fixture",
      });
      expect(JSON.stringify(settings)).not.toContain("private-secret");
      expect(JSON.stringify(settings)).not.toContain("private-role");
      const status = await new Promise<number | undefined>(
        (resolve, reject) => {
          const request = httpRequest(
            {
              hostname: "127.0.0.1",
              port,
              path: "/api/cloud/config",
              headers: { Host: "attacker.example" },
            },
            (res) => {
              res.resume();
              resolve(res.statusCode);
            },
          );
          request.on("error", reject);
          request.end();
        },
      );
      expect(status).toBe(403);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});


describe("preference proposal provenance",()=>{
  it("only returns a valid proposal supported by the current typed conversation",()=>{
    const request={...requestFixture(),text:"I dislike mushrooms."};
    const answer={...modelFixture(),intent:"conversation" as const,preferenceProposal:{evidence:"I dislike mushrooms.",description:"Avoid mushrooms in meal ideas.",changes:[{field:"dislikes" as const,operation:"add" as const,value:"mushrooms"}]}};
    expect(normalizeAnswer(answer,request,new Map()).preferenceProposal).toEqual(answer.preferenceProposal);
    expect(normalizeAnswer(answer,{...request,text:"What is for dinner?"},new Map()).preferenceProposal).toBeNull();
    expect(normalizeAnswer(answer,{...request,image:"data:image/png;base64,AAAA"},new Map()).preferenceProposal).toBeNull();
    expect(normalizeAnswer({...answer,intent:"grocery"},request,new Map()).preferenceProposal).toBeNull();
  });
  it("rejects unsupported preference values without changing the response into a write",()=>{
    const request={...requestFixture(),text:"I cook for two people."};
    const answer={...modelFixture(),intent:"conversation" as const,preferenceProposal:{evidence:request.text,description:"Household size.",changes:[{field:"householdSize" as const,operation:"set" as const,value:"200"}]}};
    const result=normalizeAnswer(answer,request,new Map());expect(result.preferenceProposal).toBeNull();expect(result.warnings.join(' ')).toContain("unchanged");
  });
});
