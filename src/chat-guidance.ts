/** Help is available without a provider, account, or changes to tracking data. */
export function isChatHelp(text: string) {
  const phrase = text
    .trim()
    .toLowerCase()
    .replace(/[?!.,]+$/, "");
  return /^(?:help(?: me(?: get started)?)?|(?:hi|hello|hey)(?: spot)?|(?:what|how) (?:should|can|do) i (?:say|ask|type|send|start|log)(?: here| you| to you)?|what can (?:you do|i ask you)|how (?:does this work|do i (?:use this(?: app)?|get started))|(?:i(?:'m| am) )?(?:not sure|don'?t know) (?:what to (?:say|do)|where to start))$/.test(
    phrase,
  );
}

export function chatGuidance(connected: boolean) {
  const common =
    "Start with one meal or workout. Open “What can I say to Spot?” in Chat for examples that don’t save anything. Try “How am I doing today?” to see your logged nutrition, or “Start my workout” to open a session. A grocery receipt helps keep foods handy for later portion logging; purchases never count as food eaten. “Open pantry” shows your ingredients.";
  return connected
    ? `${common} For food, try “I ate 2 eggs and a slice of toast.” For training, try “Bench press: 3×8 at 135 lb.” Include amounts when you can; review the details before saving. You can also ask questions, like “Why do rest days matter?” or “How can I get more protein?”`
    : `${common} Connected chat is unavailable, so free-form food descriptions can’t be estimated right now. Use Nutrition → Enter meal manually to log food, or open Your account to check sign-in and retry the connection.`;
}
