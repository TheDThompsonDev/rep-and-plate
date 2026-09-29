import { z } from 'zod';
import { preferencesSchema,type FoodPreferences } from './contracts.ts';

export const preferenceProposalSchema=z.object({
  evidence:z.string().trim().min(1).max(500),
  description:z.string().trim().min(1).max(500),
  changes:z.array(z.object({
    field:z.enum(['restrictions','dislikes','favorites','equipment','cookingMinutes','householdSize','budget','workoutPreferences','shoppingPriority','weeklyBudget','shoppingCurrency','preferredStores','brandFlexibility']),
    operation:z.enum(['add','remove','set']),
    value:z.string().trim().min(1).max(2000),
  })).min(1).max(6),
});
export type PreferenceProposal=z.infer<typeof preferenceProposalSchema>;
export type PreferenceProposalStatus='pending'|'accepted'|'dismissed';
const listFields=new Set(['restrictions','dislikes','favorites','equipment','preferredStores']);
const canonical=(value:string)=>value.trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US');

/** Returns a new preferences value. The caller must wait for explicit user acceptance before saving it. */
export function applyPreferenceProposal(current:FoodPreferences,input:PreferenceProposal):FoodPreferences {
  const proposal=preferenceProposalSchema.parse(input);
  const next=preferencesSchema.parse(current);
  const touched=new Map<string,string>();
  for(const change of proposal.changes) {
    const value=change.value.trim().replace(/\s+/g,' ');
    if(listFields.has(change.field)) {
      if(change.operation==='set')throw new Error('List preferences must name one item to add or remove.');
      if(value.length>150)throw new Error('Keep each preference to 150 characters or fewer.');
      const field=change.field as 'restrictions'|'dislikes'|'favorites'|'equipment'|'preferredStores';
      const token=`${field}:${canonical(value)}`;
      const prior=touched.get(token);
      if(prior && prior!==change.operation)throw new Error('This proposal both adds and removes the same preference. Ask Rep & Plate to clarify.');
      touched.set(token,change.operation);
      const existing=next[field] ?? [];
      if(change.operation==='remove')next[field]=existing.filter(item=>canonical(item)!==canonical(value));
      else if(!existing.some(item=>canonical(item)===canonical(value)))next[field]=[...existing,value];
    } else {
      if(change.operation!=='set')throw new Error('This preference needs a replacement value.');
      if(touched.has(change.field))throw new Error('This proposal sets the same preference more than once. Ask Rep & Plate to clarify.');
      touched.set(change.field,value);
      if(change.field==='cookingMinutes' || change.field==='householdSize') {
        if(!/^[0-9]+$/.test(value))throw new Error('Cooking time and household size must be whole numbers, without units.');
        const number=Number(value);
        const [minimum,maximum]=change.field==='cookingMinutes'?[5,240]:[1,20];
        if(!Number.isSafeInteger(number)||number<minimum||number>maximum)throw new Error(`${change.field==='cookingMinutes'?'Cooking time':'Household size'} must be between ${minimum} and ${maximum}.`);
        next[change.field]=number;
      } else if(change.field==='budget') {
        if(!['unknown','economy','flexible'].includes(value))throw new Error('Choose an unspecified, economy, or flexible budget preference.');
        next.budget=value as FoodPreferences['budget'];
      } else if(change.field==='workoutPreferences')next.workoutPreferences=value;
      else if(change.field==='weeklyBudget')next.weeklyBudget=value==='unknown'?null:Number(value);
      else if(change.field==='shoppingCurrency')next.shoppingCurrency=value;
      else if(change.field==='shoppingPriority')next.shoppingPriority=value as FoodPreferences['shoppingPriority'];
      else if(change.field==='brandFlexibility')next.brandFlexibility=value as FoodPreferences['brandFlexibility'];
      else throw new Error('This preference cannot be changed here.');
    }
  }
  next.updatedAt=new Date().toISOString();
  return preferencesSchema.parse(next);
}

export const preferenceFieldLabels:Record<PreferenceProposal['changes'][number]['field'],string>={
  restrictions:'Food exclusions',dislikes:'Foods you dislike',favorites:'Favorite meals',equipment:'Cooking equipment',
  cookingMinutes:'Cooking time',householdSize:'People to cook for',budget:'Budget preference',workoutPreferences:'Workout preferences',
  shoppingPriority:'Shopping priority',weeklyBudget:'Weekly grocery budget',shoppingCurrency:'Budget currency',preferredStores:'Preferred stores',brandFlexibility:'Trying other brands',
};

export function preferenceValueText(field:PreferenceProposal['changes'][number]['field'],value:FoodPreferences[typeof field]):string {
  if(Array.isArray(value))return value.length?value.join(', '):'None specified';
  if(value==null || value==='')return 'Not specified';
  if(field==='cookingMinutes')return `${value} minutes`;
  if(field==='budget')return value==='unknown'?'Not specified':value==='economy'?'Keep costs down':'Flexible';
  return String(value);
}
