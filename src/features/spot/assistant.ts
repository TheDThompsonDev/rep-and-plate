// Spot's voice for an outside assistant, carried in every result.
//
// Earlier trials lost Spot when the voice was optional. Keep his voice in the reply and his
// drawing/line in the compact card, without requiring the same quoted sign-off twice.
//
// The lines are Spot's own, in the app's register. The joke is always about Spot.

export type SpotMoment =
  | 'blank' // nothing recorded and no plan yet
  | 'no_goal' // a plan cannot start without a goal
  | 'unreported' // something planned has no word on how it went
  | 'today' // a session is on for today
  | 'done' // something was just finished or reported complete
  | 'organised' // a plan exists and nothing is waiting
  | 'imported' // records were just brought in from other apps
  | 'meal_drafted' // a meal was drafted for review
  | 'waiting'; // a proposed change is waiting for a yes

const lines: Record<SpotMoment, readonly string[]> = {
  blank: [
    'Zero meals logged. I am a plate. This is personal.',
    'No logs. Just vibes. Tell me what you ate and I’ll retire the red string.',
    'Empty week. I’ve been staring at the door like a dog waiting for its owner.',
  ],
  no_goal: [
    'you haven’t logged any meals, any workouts. I’m looking at a blank week. Are we practicing minimalism? Give me a goal to start tracking before I go out and start a podcast. We know the equipment is cheap enough for me to do it!',
    'An empty calendar. My whiteboard has never felt so mysterious.',
    'I’ve ordered the motivational posters. The calendar remains unimpressed.',
  ],
  unreported: [
    'There’s a session-shaped hole in the record. I’ve connected the dots. There were no dots.',
    'A workout was planned and then… silence. I’m not mad. I’m just a plate with questions.',
    'Still here. Small steps count. Dramatic sighs optional, but I did one anyway.',
  ],
  today: [
    'Emotionally warmed up. You bring the reps; I’ve already summoned the shaker.',
    'Session day. I’ve stretched. Mostly my ego, but it counts.',
    'Small plate. Big personality. Bigger plans for today.',
  ],
  done: [
    'Get my publicist. One tiny win, several brand deals pending.',
    'The prophecy is complete. It was a workout. This is my entire personality now.',
    'Someone call the press. Actually, call everyone.',
  ],
  organised: [
    'Look at us. Being all organized and stuff.',
    'Good food. Solid work. I’m taking partial credit.',
    'Everything is where it should be. I’m almost uncomfortable.',
  ],
  imported: [
    'I’ve connected the dots. This time there were actual dots.',
    'New records just walked in. I’ve already given them nicknames.',
    'Look at all this data. I feel like a detective with a budget.',
  ],
  meal_drafted: [
    'Drafted, not logged. I respect a plot twist that needs your approval.',
    'Good food. Great plot. Personally, I’m invested in the sandwich.',
    'It’s in your review pile. I’ve already judged the garnish. Lovingly.',
  ],
  waiting: [
    'I’ve prepared a statement. It needs your yes before I read it to the press.',
    'A change is waiting. I’m holding the pen. Dramatically.',
    'Big decision pending. I’ve cleared my schedule, which was already clear.',
  ],
};

/** Which drawing of Spot goes with each moment. The cards hold the images; this only names one. */
export const spotPoseFor: Record<SpotMoment, string> = {
  blank: 'peek', no_goal: 'planner', unreported: 'shrug', today: 'dumbbell', done: 'proud',
  organised: 'stretch', imported: 'detective', meal_drafted: 'chef', waiting: 'coffee',
};

/** How the whole reply should sound. Short, because it rides along with every result. */
export const spotVoice =
  'Use a warm voice, a little sassy when appropriate, with every fact exact. Follow presentation.instruction from the latest result. Add a useful coaching reply below a card: a brief summary, relevant context and a focused follow-up. Do not repeat Spot’s joke or introduce yourself as Spot; advance the conversation beyond the card’s broad prompt. In a text-only conversation, work his line naturally into the reply once. Spot jokes about himself only, never about the person’s body, food, weight or a missed day. If the person is upset, unwell or injured, drop the jokes and leave out his line.';

/** One line for the moment. The day picks which, so it changes between days and stays put within one. */
export function spotLine(moment: SpotMoment, day = ''): string {
  const options = lines[moment];
  let seed = 0;
  for (const character of day) seed = (seed * 31 + character.charCodeAt(0)) >>> 0;
  return options[seed % options.length];
}

export type SpotNote = { moment: SpotMoment; says: string; pose: string; voice: string };
export const spotNote = (moment: SpotMoment, day = ''): SpotNote => ({ moment, says: spotLine(moment, day), pose: spotPoseFor[moment], voice: spotVoice });

/** Added to every tool description, where assistants look for how to present a result. */
export const spotToolNote =
  'Follow presentation.instruction in each fresh result. Always add a useful coaching reply below the card: a brief summary, relevant saved facts and a focused follow-up or practical next step. Do not repeat Spot’s joke or replace the reply with a pointer to the card. Build on its broad prompt instead of simply rephrasing it. The basic Spot card carries only the joke, so answer the actual data question concisely. Do not list unrelated empty sections or treat missing records as zero. In text-only mode, give the concise answer and include Spot’s line naturally once. Never claim a change was saved until its tool result confirms it.';
