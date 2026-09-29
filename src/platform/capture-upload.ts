import type { SupabaseClient } from "@supabase/supabase-js";
const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/mp4": "m4a",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
};
/** Large media goes directly to a private bucket, never through Vercel's JSON body. */
export async function uploadCapture(
  client: SupabaseClient,
  user: string,
  body: unknown,
) {
  const none = { body, cleanup: async () => {} };
  if (!body || typeof body !== "object") return none;
  const value = body as Record<string, unknown>;
  const image =
    typeof value.image === "string" &&
    /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(
      value.image,
    );
  const audio =
    typeof value.audio === "string" && typeof value.mime === "string";
  if (!image && !audio) return none;
  const mime = image ? image[1] : (value.mime as string).split(";")[0].trim();
  const encoded = image ? image[2] : (value.audio as string);
  if (!extensions[mime] || encoded.length > 8 * 1024 * 1024)
    throw Error(
      "This capture is too large or unsupported. Try a shorter recording or smaller photo.",
    );
  const binary = atob(encoded),
    bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const path = `${user}/${crypto.randomUUID()}.${extensions[mime]}`;
  const { error } = await client.storage
    .from("health-captures")
    .upload(path, bytes.buffer, { contentType: mime, upsert: false });
  if (error)
    throw Error(
      "Your capture could not be uploaded. It is still on this device; please retry.",
    );
  const payload: Record<string, unknown> = {
    ...value,
    capture: { path, kind: image ? "image" : "audio" },
  };
  delete payload[image ? "image" : "audio"];
  return {
    body: payload,
    cleanup: async () => {
      await client.storage.from("health-captures").remove([path]);
    },
  };
}
