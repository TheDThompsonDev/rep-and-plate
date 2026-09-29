/** The local prototype remains unauthenticated on loopback. Hosted requests
 * always obtain the current Supabase session before sending personal context. */
export function isHostedBrowser() {
  return (
    typeof location !== "undefined" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)
  );
}
export async function apiFetch(path: string, init?: RequestInit) {
  if (!isHostedBrowser()) return fetch(path, init);
  const { getCloudClient, requireBrowserOwner } =
    await import("./features/cloud/client");
  const client = await getCloudClient();
  if (!client) throw Error("Sign-in is not configured yet.");
  const session = await requireBrowserOwner(client);
  const { uploadCapture } = await import("./platform/capture-upload");
  const abort = new AbortController();
  const sub = client.auth.onAuthStateChange((_event, next) => {
    if (next?.user.id !== session.user.id) abort.abort();
  });
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${session.access_token}`);
  let cleanup = async () => {};
  try {
    const upload = await uploadCapture(
      client,
      session.user.id,
      typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    );
    cleanup = upload.cleanup;
    const current = await requireBrowserOwner(client);
    if (current.user.id !== session.user.id)
      throw Error("Your account changed. Please retry.");
    abort.signal.throwIfAborted();
    const response = await fetch(path, {
      ...init,
      body:
        upload.body === undefined ? init?.body : JSON.stringify(upload.body),
      headers,
      signal: AbortSignal.any([
        abort.signal,
        ...(init?.signal ? [init.signal] : []),
      ]),
    });
    // Keep the subscription through streamed body consumption, with a bounded lifetime.
    const timer = setTimeout(() => sub.data.subscription.unsubscribe(), 240000);
    abort.signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        sub.data.subscription.unsubscribe();
      },
      { once: true },
    );
    return response;
  } catch (error) {
    sub.data.subscription.unsubscribe();
    throw error;
  } finally {
    await cleanup().catch(() => {});
  }
}
