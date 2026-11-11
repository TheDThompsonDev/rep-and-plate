import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CloudConfig } from "./client";

const configurations = new WeakMap<SupabaseClient, CloudConfig>();
const appOrigins = new WeakMap<SupabaseClient, string>();
export function registerAccountConfig(
  client: SupabaseClient,
  config: CloudConfig,
  appOrigin?: string | null,
) {
  configurations.set(client, config);
  const origin = usableAppOrigin(appOrigin);
  if (origin) appOrigins.set(client, origin);
  else appOrigins.delete(client);
}

/** An address is worth naming only if a browser can open it: HTTPS, or plain HTTP on this computer. */
export function usableAppOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return null;
  return url.origin;
}

/**
 * Where links in an auth email should lead: the app this person is using.
 *
 * Without it Supabase sends every link to the project's Site URL. That setting was left on a
 * development address, so sign-up confirmations and recovery emails sent real people to localhost.
 * Supabase honours this only for addresses on the project's Redirect URLs list and otherwise falls
 * back to the Site URL, so naming it cannot make things worse.
 */
export function authEmailOptions(client: SupabaseClient): { emailRedirectTo?: string } {
  const origin = appOrigins.get(client);
  return origin ? { emailRedirectTo: origin } : {};
}
/** The same, shaped for `signUp`, which takes it under `options`. Empty when there is nothing to name. */
export function signUpEmailOptions(client: SupabaseClient): { options?: { emailRedirectTo: string } } {
  const origin = appOrigins.get(client);
  return origin ? { options: { emailRedirectTo: origin } } : {};
}
export function isolatedAccountClient(client: SupabaseClient) {
  const config = configurations.get(client);
  if (!config) throw new Error("Reconnect your account before continuing.");
  return createClient(config.url, config.publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: `rep-and-plate.recovery.${crypto.randomUUID()}`,
    },
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(20000) }),
    },
  });
}

function emailAddress(email: string) {
  const value = email.trim();
  if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    throw Error("Enter your account email address.");
  return value;
}
export async function requestPasswordCode(
  client: SupabaseClient,
  email: string,
) {
  const isolated = isolatedAccountClient(client);
  const result = await isolated.auth.signInWithOtp({
    email: emailAddress(email),
    options: { shouldCreateUser: false, ...authEmailOptions(client) },
  });
  if (
    result.error &&
    (result.error.code?.includes("rate_limit") || result.error.status === 429)
  )
    throw Error("Please wait a minute before requesting another code.");
  // Never reveal whether an address already has an account.
  if (
    result.error &&
    result.error.status !== 400 &&
    result.error.status !== 422
  )
    throw Error(
      "The email could not be sent. Check your connection and try again.",
    );
}

export async function recoverPassword(
  client: SupabaseClient,
  email: string,
  code: string,
  password: string,
) {
  if (!/^\d{6,10}$/.test(code.trim()))
    throw Error("Enter the code from your email.");
  if (password.length < 8 || password.length > 128)
    throw Error("Choose a password between 8 and 128 characters.");
  const isolated = isolatedAccountClient(client);
  try {
    const result = await isolated.auth.verifyOtp({
      email: emailAddress(email),
      token: code.trim(),
      type: "email",
    });
    if (
      result.error ||
      !result.data.session ||
      result.data.user?.email?.toLowerCase() !== email.trim().toLowerCase()
    )
      throw Error(
        "That code is invalid or has expired. Request another code and try again.",
      );
    const update = await isolated.auth.updateUser({ password });
    if (update.error)
      throw Error(
        "The new password was not accepted. Choose a different password and request a new code.",
      );
  } finally {
    await isolated.auth.signOut({ scope: "local" }).catch(() => {});
  }
}

export async function changeAccountPassword(
  client: SupabaseClient,
  currentPassword: string,
  newPassword: string,
) {
  if (newPassword.length < 8 || newPassword.length > 128)
    throw Error("Choose a password between 8 and 128 characters.");
  const current = await client.auth.getUser();
  if (current.error || !current.data.user?.email)
    throw Error("Sign in again before changing your password.");
  const expected = current.data.user;
  const isolated = isolatedAccountClient(client);
  try {
    const signed = await isolated.auth.signInWithPassword({
      email: expected.email!,
      password: currentPassword,
    });
    if (signed.error || signed.data.user?.id !== expected.id)
      throw Error("Your current password could not be confirmed.");
    const update = await isolated.auth.updateUser({ password: newPassword });
    if (update.error)
      throw Error(
        "The new password was not accepted. Choose a different password and try again.",
      );
  } finally {
    await isolated.auth.signOut({ scope: "local" }).catch(() => {});
  }
}
