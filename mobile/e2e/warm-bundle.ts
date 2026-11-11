import type { FullConfig } from "@playwright/test";

// Metro compiles the app on the first request. On a cold cache, which is every CI run, that takes
// longer than a test's timeout, so the first test would fail for a reason unrelated to the app.
// Compile once here, and fail with the real reason if the app does not build at all.
export default async function warmBundle(config: FullConfig) {
  const base = config.projects[0]?.use.baseURL ?? "http://127.0.0.1:8081";
  const page = await (await fetch(base)).text();
  const source = page.match(/<script[^>]+src="([^"]+\.bundle[^"]*)"/)?.[1];
  if (!source) throw Error("The native web page did not reference an app bundle.");
  const response = await fetch(new URL(source.replaceAll("&amp;", "&"), base), {
    signal: AbortSignal.timeout(300_000),
  });
  if (!response.ok)
    throw Error(`The native web bundle failed to build (HTTP ${response.status}).`);
  await response.arrayBuffer();
}
