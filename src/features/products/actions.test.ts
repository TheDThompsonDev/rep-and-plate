import { describe,it,expect } from "vitest";
import { initialState,stateSchema,sumNutrition } from "../../domain";
import { normalizeGTIN,nutritionForServing,type FoodProduct } from "./contracts";
import { captureProduct,savePrivateProduct } from "./actions";
const product:FoodProduct={id:"fixture",gtin:"00049000006346",name:"Fixture milk",brand:"Fixture",ingredients:"Milk",serving:{label:"1 cup",amount:240,unit:"ml"},basis:"100ml",nutrition:{calories:60,protein:3,carbs:5,fat:3},source:{provider:"usda",id:"1",url:"https://fdc.nal.usda.gov/food-details/1/nutrients",fetchedAt:new Date().toISOString(),updatedAt:null,release:null},verification:"source",version:"1"};
describe("product capture",()=>{
  it("validates checksums and keeps leading-zero identity",()=>{expect(normalizeGTIN("049000006346")).toBe(product.gtin);expect(normalizeGTIN("049000006347")).toBeNull();});
  it("scales volume basis but never invents mass density",()=>{expect(nutritionForServing(product)?.calories).toBe(144);expect(nutritionForServing({...product,basis:"100g"})).toBeNull();});
  it("purchases don't add intake; replayed actions cannot duplicate",()=>{const state=initialState(),next=captureProduct(state,product,"grocery",8,"op");expect(sumNutrition(next.meals)).toEqual(sumNutrition(state.meals));expect(next.groceries?.at(-1)?.items[0].servingsPurchased).toBe(8);expect(captureProduct(next,product,"grocery",8,"op")).toBe(next);expect(stateSchema.safeParse(next).success).toBe(true);});
  it("consumed food keeps a nutrition snapshot and future correction doesn't rewrite it",()=>{const next=captureProduct(initialState(),product,"meal",0.5,"meal");expect(next.meals.at(-1)?.calories).toBe(72);const corrected=savePrivateProduct(next,{...product,nutrition:{...product.nutrition,calories:70},version:"2"});expect(corrected.meals.at(-1)?.components?.[0].productSnapshot?.version).toBe("1");expect(stateSchema.safeParse(corrected).success).toBe(true);});
});
