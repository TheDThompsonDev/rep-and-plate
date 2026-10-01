import { activityProposalSchema, type ActivityProposal } from './activity-contract';
import { id, today, type AppState } from './domain';
export { activityProposalSchema, activitySchema, type ActivityProposal, type Activity } from './activity-contract';

export function addActivity(state: AppState, input: ActivityProposal): AppState {
  const activity = activityProposalSchema.parse(input);
  const date = new Date(`${activity.day}T12:00:00`);
  if (!Number.isFinite(date.getTime()) || date.getDate() !== Number(activity.day.slice(-2)) || activity.day > today())
    throw new Error('Choose a valid activity date that is not in the future.');
  return {...state,activities:[...(state.activities ?? []),{...activity,id:id()}]};
}

/** Review is explicit; repeated acceptance cannot double-count a capture. */
export function resolveActivityProposal(state: AppState, messageId: string, accept: boolean): AppState {
  const message = state.messages.find(entry => entry.id === messageId);
  if (!message?.activityProposal || message.activityCaptureStatus !== 'pending') return state;
  const next = accept ? addActivity(state,message.activityProposal) : state;
  return {...next,messages:next.messages.map(entry => entry.id === messageId ? {...entry,activityCaptureStatus:accept ? 'accepted' as const : 'dismissed' as const} : entry)};
}
