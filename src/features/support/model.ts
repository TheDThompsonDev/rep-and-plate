export function validSupportUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2000) return;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password)
      return url.href;
  } catch {
    /* An absent or invalid contact must not become a broken link. */
  }
}

export const dataHandling = [
  {
    title: "Your records",
    text: "Meals, groceries, plans, workouts, preferences and conversations are kept on your device. When account saving is enabled, records and their saved photos are also stored privately in your Rep & Plate account. Check the account saving status before changing devices. An offline device may still hold changes that have not reached your account.",
  },
  {
    title: "When you ask Spot",
    text: "Relevant messages, saved context and any capture you submit are sent to the AI services needed to answer. Qwen leads the conversation, OpenAI can provide a backup response and voice transcription, and Jev checks purchase-versus-meal intent. These providers process submitted content under their own terms. Avoid including payment details or other information you do not want processed.",
  },
  {
    title: "Temporary uploads and service records",
    text: "Private uploads used to read a capture are separate from photos saved with your records. A daily cleanup removes temporary captures older than 24 hours and expired response caches. Service monitoring stores account and request identifiers, model, timing, token counts and success or failure for up to 90 days plus the cleanup interval. It does not store message text, images or provider error details in monitoring records.",
  },
  {
    title: "Your controls",
    text: "Use Account & saved data to export records and manage your account. Signing out does not erase local records. Account deletion removes the server account and saved data; downloaded exports and copies on other offline devices can remain until you remove them. Use a personal device for private records.",
  },
];

export function supportDiagnostics(
  platform: "web" | "ios" | "android" | "native",
  requestIds: readonly string[] = [],
) {
  return JSON.stringify(
    {
      app: "Rep & Plate",
      version: "1.0.0",
      platform,
      createdAt: new Date().toISOString(),
      requestIds: requestIds
        .filter((value) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            value,
          ),
        )
        .slice(-5),
    },
    null,
    2,
  );
}
