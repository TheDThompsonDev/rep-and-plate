import { fetch as expoFetch } from "expo/fetch";
import {
  aiResultSchema,
  type AIRequest,
  type AIResult,
} from "../../src/ai-contract";
import { credentials } from "./storage";
import { validateCloudConfig } from "../../src/features/cloud/client";
import {
  configureAuth,
  requireDeviceOwner,
  sessionSignal,
  resetAuth,
  invalidateSession,
} from "./auth";
import { uploadCapture } from "../../src/platform/capture-upload";
export type Connection = { url: string; token: string };
let connection: Connection | null = null;
const responseSignals = new WeakMap<Response, AbortSignal>();
export function validConnection(value: Connection) {
  const url = new URL(value.url);
  const local =
    /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(
      url.hostname,
    );
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    (url.protocol !== "https:" && !(url.protocol === "http:" && local))
  )
    throw new Error(
      "Use an HTTPS server or a private development-network address.",
    );
  if (value.token.trim() && !/^[a-f0-9]{64}$/.test(value.token.trim()))
    throw new Error(
      "Enter the 64-character pairing code from your development server.",
    );
  if (!value.token.trim() && url.protocol !== "https:")
    throw new Error(
      "A hosted beta connection requires HTTPS. Local development needs a pairing code.",
    );
  return { url: url.origin, token: value.token.trim() };
}
export async function loadConnection() {
  const raw = await credentials.getItem("health.connection");
  if (raw) connection = validConnection(JSON.parse(raw));
  else if (process.env.EXPO_PUBLIC_API_URL) connection = validConnection({ url: process.env.EXPO_PUBLIC_API_URL, token: '' });
  return connection;
}
export async function connect(value: Connection) {
  const checked = validConnection(value);
  const result = await expoFetch(
    `${checked.url}${checked.token ? "/api/status" : "/api/cloud/config"}`,
    {
      headers: checked.token
        ? { Authorization: `Bearer ${checked.token}` }
        : {},
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!result.ok)
    throw new Error("Pairing failed. Check the server address and code.");
  const data = await result.json();
  if (!checked.token && !validateCloudConfig(data))
    throw Error("This address did not return valid beta sign-in settings.");
  await credentials.setItem("health.connection", JSON.stringify(checked));
  resetAuth();
  connection = checked;
  return data;
}
export async function cloudClient() {
  if (!connection) await loadConnection();
  if (!connection) throw Error("Set your server address in Connection first.");
  const selected = connection;
  const response = await expoFetch(`${selected.url}/api/cloud/config`, {
    headers: selected.token
      ? { Authorization: `Bearer ${selected.token}` }
      : {},
    signal: AbortSignal.timeout(10000),
  });
  if (selected !== connection)
    throw Error("Your connection changed. Try again.");
  const config = response.ok && validateCloudConfig(await response.json());
  if (!config)
    throw Error(
      "Cloud is not configured on this server. You can still export your records.",
    );
  return configureAuth(config);
}
export async function api(path: string, body?: unknown, signal?: AbortSignal) {
  if (!connection) await loadConnection();
  if (!connection)
    throw new Error(
      "Set your server address in You → Connection to use AI and product lookup.",
    );
  const selected = connection;
  let token = selected.token;
  const c = token ? null : await cloudClient();
  const session = c ? await requireDeviceOwner(c) : null;
  if (session) token = session.access_token;
  if (selected !== connection)
    throw Error("Your connection changed. Please retry.");
  const identitySignal = sessionSignal();
  const requestSignal = AbortSignal.any([
    identitySignal,
    AbortSignal.timeout(185000),
    ...(signal ? [signal] : []),
  ]);
  const upload =
    c && session
      ? await uploadCapture(c, session.user.id, body)
      : { body, cleanup: async () => {} };
  let response: Response;
  try {
    requestSignal.throwIfAborted();
    response = await expoFetch(`${selected.url}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: upload.body === undefined ? undefined : JSON.stringify(upload.body),
      signal: requestSignal,
    });
  } finally {
    await upload.cleanup().catch(() => {});
  }
  requestSignal.throwIfAborted();
  if (!response.ok) {
    if (response.status === 401 && !selected.token) invalidateSession();
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error ?? `Request failed (${response.status}). Please try again.`,
    );
  }
  responseSignals.set(response, requestSignal);
  return response;
}
export async function jsonApi(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
) {
  const response = await api(path, body, signal);
  const value = await response.json();
  responseSignals.get(response)?.throwIfAborted();
  return value;
}
export async function chat(
  request: AIRequest,
  progress: (text: string) => void,
  signal: AbortSignal,
): Promise<AIResult> {
  const response = await api("/api/chat", request, signal);
  const reader = response.body?.getReader();
  if (!reader)
    throw new Error("The connection closed before the answer arrived.");
  const decoder = new TextDecoder();
  let buffer = "";
  let result: AIResult | undefined;
  const line = (value: string) => {
    if (!value.trim()) return;
    const event = JSON.parse(value);
    if (event.type === "progress") progress(event.text);
    if (event.type === "error") throw new Error(event.error);
    if (event.type === "result") result = aiResultSchema.parse(event.result);
  };
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      let end;
      while ((end = buffer.indexOf("\n")) >= 0) {
        line(buffer.slice(0, end));
        buffer = buffer.slice(end + 1);
      }
    }
    line(buffer + decoder.decode());
  } finally {
    reader.releaseLock();
  }
  responseSignals.get(response)?.throwIfAborted();
  if (!result || result.requestId !== request.requestId)
    throw new Error("The response was incomplete. Retry your saved capture.");
  return result;
}
