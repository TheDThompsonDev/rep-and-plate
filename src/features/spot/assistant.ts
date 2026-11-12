// Spot's voice for an outside assistant, carried in every result.
//
// Server instructions describe Spot, but a real Claude chat reply came back as a plain inventory of
// records with no trace of him: not every host passes instructions on, and a bare list of numbers
// gives the assistant nothing to say. So each result names the moment and hands over one line the
// assistant can close with. The lines are Spot's own, from the app; the joke is always about Spot.

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
  blank: ['No logs. Just vibes. Tell me what you ate and I’ll retire the red string.', 'Always here. In a supportive way.'],
  no_goal: ['Spot is holding a blank week and calling it minimalism.', 'Always here. In a supportive way.'],
  unreported: ['Still here. Small steps count. Dramatic sighs optional.', 'I’ve connected the dots. There were no dots, only a session-shaped gap.'],
  today: ['Emotionally warmed up. You bring the reps; I’ve already summoned the shaker.', 'Small plate. Big personality. Bigger plans for today.'],
  done: ['Get my publicist. One tiny win, several brand deals pending.', 'The prophecy is complete. It was a workout. This is my entire personality now.'],
  organised: ['Look at us. Being all organized and stuff.', 'Good food. Solid work. I’m taking partial credit.'],
  imported: ['I’ve connected the dots. This time there were actual dots.', 'Look at us. Being all organized and stuff.'],
  meal_drafted: ['Good food. Great plot. Personally, I’m invested in the sandwich.', 'Drafted, not logged. I respect a plot twist that needs your approval.'],
  waiting: ['I have prepared a statement. It needs your yes before I read it to the press.', 'Still here. Holding the pen. Dramatically.'],
};

/** How an assistant should use the line. Kept short because it rides along with every result. */
export const spotHow =
  'Answer in plain words first, and say something encouraging about what the person did or can do next rather than only listing records. Then you may close with this line, or one like it, once. It is Spot talking about himself: never joke about the person’s body, food, weight or a missed day, and leave it out if they are frustrated, unwell or injured.';

/** One line for the moment. The day picks which, so it changes between days and stays put within one. */
export function spotLine(moment: SpotMoment, day = ''): string {
  const options = lines[moment];
  let seed = 0;
  for (const character of day) seed = (seed * 31 + character.charCodeAt(0)) >>> 0;
  return options[seed % options.length];
}

export type SpotNote = { moment: SpotMoment; line: string; how: string };
export const spotNote = (moment: SpotMoment, day = ''): SpotNote => ({ moment, line: spotLine(moment, day), how: spotHow });
