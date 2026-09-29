import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AppState as Lifecycle } from "react-native";
import { credentials, deviceOwnership,switchNativeAccount } from "./storage";
import {registerAccountConfig} from '../../src/features/cloud/account-client';
import type { CloudConfig } from "../../src/features/cloud/client";

let client: SupabaseClient | null = null;
let project = "";
let initialize: Promise<SupabaseClient> | null = null;
let cleanup = () => {};
let account: string | null = null;
let epoch = new AbortController();
export const sessionSignal = () => epoch.signal;
export function invalidateSession() {
  epoch.abort();
  epoch = new AbortController();
}
export function resetAuth() {
  invalidateSession();
  cleanup();
  client = null;
  initialize = null;
  project = "";
  account = null;
}
export function configureAuth(config: CloudConfig): Promise<SupabaseClient> {
  if (initialize && project === config.url) return initialize;
  resetAuth();
  project = config.url;
  const c = createClient(config.url, config.publishableKey, {
    auth: {
      storage: credentials,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  client = c;
  registerAccountConfig(c,config);
  const subscription = c.auth.onAuthStateChange((_event, session) => {
    const next = session?.user.id ?? null;
    if (account !== next) {
      invalidateSession();
      account = next;
    }
  });
  const life = Lifecycle.addEventListener("change", (state) => {
    if (state === "active") c.auth.startAutoRefresh();
    else c.auth.stopAutoRefresh();
  });
  if (Lifecycle.currentState !== "active") c.auth.stopAutoRefresh();
  cleanup = () => {
    subscription.data.subscription.unsubscribe();
    life.remove();
    c.auth.stopAutoRefresh();
  };
  initialize = c.auth.getSession().then(({ error }) => {
    if (error) throw error;
    return c;
  });
  return initialize;
}
export async function requireDeviceOwner(c: SupabaseClient, bind = false) {
  const { data, error } = await c.auth.getSession();
  const user = data.session?.user;
  if (error || !user || c !== client)
    throw Error(
      "Sign in from Your profile → Cloud & your records to continue.",
    );
  const identity = `${project}:${user.id}`;
  const owner = await deviceOwnership.get();
  if (owner && owner !== identity && !bind)
    throw Error(
      "These device records belong to another account. Sign in with the original account. Your records have not been sent.",
    );
  if (!owner) {
    if (!bind)
      throw Error(
        "Open Cloud & your records and confirm that these device records are yours before using the beta.",
      );
    await switchNativeAccount(identity);
  }
  if(owner&&owner!==identity&&bind)await switchNativeAccount(identity);
  if (c !== client || account !== user.id)
    throw Error("Your account changed. Please try again.");
  return data.session!;
}
