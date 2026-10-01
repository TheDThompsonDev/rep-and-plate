import { createClient } from "@supabase/supabase-js";
import { aiResultSchema } from "../src/ai-contract.ts";
import { validateCloudConfig } from "../src/features/cloud/client.ts";
import { readConfig } from "./http.ts";
import type { BetaServices } from "./beta.ts";
import {createAccountDeletion} from './account.ts';
import {createOperationsServices} from './operations-services.ts';
import { defaultSupportUrl } from '../src/features/support/model.ts';

export function betaServices(
  env: Record<string, string | undefined>,
): BetaServices {
  const config = readConfig(env);
  const publicConfig = validateCloudConfig({
    url: config.supabaseUrl,
    publishableKey: config.supabasePublishableKey,
    supportUrl:env.SUPPORT_URL || defaultSupportUrl,
  });
  const secret = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  const origin = new URL(env.APP_ORIGIN || "invalid");
  if (
    !publicConfig ||
    !secret ||
    origin.protocol !== "https:" ||
    origin.origin !== env.APP_ORIGIN
  )
    throw Error("BETA_CONFIG");
  const options = {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(10000) }),
    },
  };
  const auth = createClient(
    publicConfig.url,
    publicConfig.publishableKey,
    options,
  );
  const admin = createClient(publicConfig.url, secret, options);
  async function rpc(name: string, args: Record<string, unknown>) {
    const { data, error } = await admin.rpc(name, args);
    if (error) throw Error("BETA_STORAGE_UNAVAILABLE");
    return data;
  }
  return {
    config,
    deleteAccount:createAccountDeletion(publicConfig,admin),
    recordGeneration:createOperationsServices(env).recordGeneration,
    publicConfig,
    origin: origin.origin,
    authenticate: async (token) => {
      const { data, error } = await auth.auth.getUser(token);
      return error ? null : (data.user?.id ?? null);
    },
    admit: (user, expensive) =>
      rpc("health_admit", { p_user: user, p_expensive: expensive }),
    release: (lease) => rpc("health_release", { p_lease: lease }),
    readCapture: async (user, path) => {
      if (!path.startsWith(user + "/")) throw Error("CAPTURE_OWNER");
      const { data, error } = await admin.storage
        .from("health-captures")
        .download(path);
      if (error || !data || data.size > 6 * 1024 * 1024)
        throw Error("CAPTURE_UNAVAILABLE");
      return {
        bytes: Buffer.from(await data.arrayBuffer()),
        mime: data.type.split(";")[0],
      };
    },
    chatCache: {
      claim: async (user, request, hash) => {
        const value = await rpc("health_chat_claim", {
          p_user: user,
          p_request: request,
          p_hash: hash,
        });
        if (value.status === "cached")
          value.result = aiResultSchema.parse(value.result);
        if (!["cached", "new", "busy", "mismatch"].includes(value.status))
          throw Error("INVALID_CLAIM");
        return value;
      },
      finish: async (user, request, lease, result) => {
        const saved = await rpc("health_chat_finish", {
          p_user: user,
          p_request: request,
          p_lease: lease,
          p_result: result,
        });
        if (saved !== true) throw Error("LEASE_EXPIRED");
      },
      fail: (user, request, lease) =>
        rpc("health_chat_fail", {
          p_user: user,
          p_request: request,
          p_lease: lease,
        }),
    },
  };
}
