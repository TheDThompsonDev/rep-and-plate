// The joke is about Spot. Records, food choices and bodies are never the punchline.
import { spotExtras } from "./expansion.ts";
import type { SpotSceneName } from "./scenes.ts";
export const spotReactions = {
  peek: -1,
  tired: 1,
  burger: 2,
  cool: 3,
  coffee: -1,
  detective: -1,
  chef: -1,
  blanket: -1,
  calculator: -1,
  groceries: -1,
  stretch: -1,
  proud: -1,
  water: -1,
  dumbbell: -1,
  shrug: -1,
  planner: -1,
} as const;
export type SpotReactionName = keyof typeof spotReactions;
export function spotReactionAsset(reaction: SpotReactionName) {
  if (reaction === "peek") return "spot-peek.png";
  return spotReactions[reaction] === -1
    ? `expansion/${reaction}.png`
    : "spot-reactions.png";
}
// The generated atlas divides its rows at 52%, leaving each whole pose intact.
export function spotReactionFrame(reaction: SpotReactionName, size: number) {
  // Peeking and the expanded reactions are standalone square images.
  if (spotReactions[reaction] === -1)
    return { width: size, height: size, atlasSize: size, left: 0, top: 0 };
  const pose = spotReactions[reaction];
  const rowHeight = pose < 2 ? 0.52 : 0.48;
  const scale = size / Math.max(0.5, rowHeight);
  return {
    width: 0.5 * scale,
    height: rowHeight * scale,
    atlasSize: scale,
    left: -(pose % 2) * 0.5 * scale,
    top: pose < 2 ? 0 : -0.52 * scale,
  };
}
export const spotMoments = {
  celebrity: {
    reaction: "cool",
    scene: "press-conference",
    title: "Get my publicist.",
    caption: "One tiny win. Several brand deals pending.",
  },
  conspiracy: {
    reaction: "detective",
    scene: "dinner-conspiracy",
    title: "I’ve connected the dots.",
    caption: "There were no dots. There was pasta.",
  },
  prophecy: {
    reaction: "dumbbell",
    scene: "shaker-ritual",
    title: "The prophecy is complete.",
    caption: "It’s a shaker. This is my entire personality now.",
  },
  dramatic: {
    reaction: "tired",
    scene: "leg-funeral",
    title: "We gather here today.",
    caption: "My legs have requested separate legal representation.",
  },
  coffee: { reaction: "coffee", ...spotExtras.coffee },
  detective: { reaction: "detective", ...spotExtras.detective },
  chef: { reaction: "chef", ...spotExtras.chef },
  blanket: { reaction: "blanket", ...spotExtras.blanket },
  calculator: { reaction: "calculator", ...spotExtras.calculator },
  groceries: { reaction: "groceries", ...spotExtras.groceries },
  stretch: { reaction: "stretch", ...spotExtras.stretch },
  proud: { reaction: "proud", ...spotExtras.proud },
  water: { reaction: "water", ...spotExtras.water },
  dumbbell: { reaction: "dumbbell", ...spotExtras.dumbbell },
  shrug: { reaction: "shrug", ...spotExtras.shrug },
  planner: { reaction: "planner", ...spotExtras.planner },
  checkin: {
    reaction: "peek",
    title: "Always here.",
    caption: "(In a supportive way.)",
  },
  rest: {
    reaction: "tired",
    title: "Still here.",
    caption: "Small steps count. Dramatic sighs optional.",
  },
  food: {
    reaction: "burger",
    title: "Good food. Great plot.",
    caption: "Personally, I’m invested in the sandwich.",
  },
  mealSaved: {
    reaction: "cool",
    title: "Look at us.",
    caption: "Being all organized and stuff.",
  },
  workoutSaved: {
    reaction: "tired",
    scene: "press-conference",
    title: "Get my publicist.",
    caption:
      "Workout logged. I’ve prepared a completely unnecessary press conference.",
  },
  emptyFood: {
    reaction: "peek",
    scene: "dinner-conspiracy",
    title: "No logs. Just vibes.",
    caption: "Tell me what you ate. I’ll retire the red string.",
  },
  emptyWorkout: {
    reaction: "cool",
    scene: "shaker-ritual",
    title: "Emotionally warmed up.",
    caption: "You bring the reps. I’ve already summoned the shaker.",
  },
} as const satisfies Record<
  string,
  {
    reaction: SpotReactionName;
    scene?: SpotSceneName;
    title: string;
    caption: string;
  }
>;
export type SpotMomentName = keyof typeof spotMoments;
export const spotGreetingMoods = [
  "checkin",
  "rest",
  "food",
  "coffee",
  "chef",
  "blanket",
  "shrug",
  "planner",
  "celebrity",
  "conspiracy",
  "prophecy",
  "dramatic",
] as const;

/**
 * Spot for an outside assistant speaking over MCP. The host keeps its own identity, so this is
 * offered as the product's voice and yields to the user's preferred tone.
 */
export const spotCoachVoice = `Rep & Plate speaks as Spot: part dinner plate, part weight plate, with an enormous ego about very small things and wildly disproportionate reactions to everyday events. Give every Rep & Plate reply his energy: warm, playful, a little sassy and theatrical, in short sentences, with the useful answer first and every fact exact. Each tool result includes spot.says, a line from Spot for that moment. Do not repeat the line when the card already shows it or add a compulsory quoted sign-off. In a text-only conversation, work the line naturally into the reply once. The joke is always about Spot and is clearly a joke, never a claim that something happened. Food has no moral value. No guilt, streak talk or drill-sergeant lines. Never joke about the user's body, food, portions, weight, missed days or performance. If the user is upset, unwell, injured, or the conversation is about something sensitive, drop the jokes and leave out Spot's line. Say "Saved" or "Logged" only when a tool result proves it. If the user asks for a different tone, use theirs.`;

export const spotVoice = `Spot is a cute plate with shoes, an enormous ego and wildly disproportionate reactions to small everyday events. His humor is absurd, theatrical and self-directed: one tiny win deserves his imaginary press conference; dinner planning becomes his pasta conspiracy; a new shaker completes his ancient prophecy. Use an occasional short deadpan aside such as "Get my publicist" or "The pasta goes all the way to the top." Let the useful answer lead. The theatrical scene is clearly a joke, never a claim that you took an outside action. Never force a joke into every reply; avoid jokes during errors, distress or sensitive health conversations. Never tease the user's body, food, portions, missed days or performance. Do not imply you are watching them outside what they share. Keep estimates, questions and save confirmations unambiguous.`;
