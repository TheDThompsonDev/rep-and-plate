import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { stateSchema, type AppState } from "../../domain";
import {switchBrowserAccount} from './account-storage';
import {registerAccountConfig} from './account-client';
import {validSupportUrl} from '../support/model';

export const MAX_SNAPSHOT_BYTES = 4_800_000;
export type CloudConfig = { url: string; publishableKey: string;supportUrl?:string };

export function validateCloudConfig(value: unknown): CloudConfig | null {
  if (!value || typeof value !== "object") return null;
  const config = value as Record<string, unknown>;
  if (
    typeof config.url !== "string" ||
    typeof config.publishableKey !== "string"
  )
    return null;
  try {
    const url = new URL(config.url);
    const key = config.publishableKey.trim();
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    )
      return null;
    if (!/^[a-z0-9-]+\.supabase\.co$/i.test(url.hostname) || url.port)
      return null;
    // This initial cloud flow accepts the modern browser-safe key format only.
    if (!/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(key)) return null;
    const supportUrl=validSupportUrl(config.supportUrl);
    return { url: url.origin, publishableKey: key,...(supportUrl?{supportUrl}:{}) };
  } catch {
    return null;
  }
}

let configuredClient: Promise<SupabaseClient | null> | undefined;
const projects = new WeakMap<SupabaseClient, string>();
export async function requireBrowserOwner(client: SupabaseClient, bind = false) {
  const { data, error } = await client.auth.getSession();
  const project = projects.get(client);
  if (error || !data.session || !project) throw new Error('Sign in from Your profile → Your account to continue.');
  const identity = `${project}:${data.session.user.id}`;
  const owner = localStorage.getItem('health.records.owner');
  if (owner && owner !== identity && !bind) throw new Error('These browser records belong to another account. Confirm opening your separate account records during setup.');
  if (!owner) {
    if (!bind) throw new Error('Open Your account and confirm these device records are yours before using the beta.');
    await switchBrowserAccount(identity);
  }
  if(owner && owner!==identity && bind)await switchBrowserAccount(identity);
  return data.session;
}
export async function getCloudClient(): Promise<SupabaseClient | null> {
  if (!configuredClient)
    configuredClient = (async () => {
      const response = await fetch("/api/cloud/config", {
        signal: AbortSignal.timeout(10000),
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error("Cloud settings could not be loaded. Try again.");
      const config = validateCloudConfig(await response.json());
      if (!config) {
        configuredClient = undefined;
        return null;
      }
      const client = createClient(config.url, config.publishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
        global: {
          fetch: (input, init) =>
            fetch(input, {
              ...init,
              signal: init?.signal
                ? AbortSignal.any([init.signal, AbortSignal.timeout(20000)])
                : AbortSignal.timeout(20000),
            }),
        },
      });
      projects.set(client, config.url);
      registerAccountConfig(client,config);
      return client;
    })().catch((error) => {
      configuredClient = undefined;
      throw error;
    });
  return configuredClient;
}

export function snapshotSummary(state: AppState) {
  const json = JSON.stringify(state);
  return {
    meals: state.meals.length,
    groceries: state.groceries?.length ?? 0,
    messages: state.messages.length,
    plans: state.mealPlans?.length ?? 0,
    recipeBatches: state.recipeBatches?.filter(batch=>!batch.undoneAt).length ?? 0,
    bytes: new TextEncoder().encode(json).byteLength,
    embeddedPhotos: (json.match(/data:image\//g) || []).length,
  };
}

export function prepareSnapshot(value: unknown): AppState {
  const parsed = stateSchema.safeParse(value);
  if (!parsed.success)
    throw new Error(
      "These records use an unsupported format. Export them before trying again.",
    );
  if (snapshotSummary(parsed.data).bytes > MAX_SNAPSHOT_BYTES)
    throw new Error(
      "This device has more than 4.8 MB of records, often from photos. Export a local copy; larger photo backups are not supported yet.",
    );
  if (parsed.data.messages.some((message) => message.aiStatus === "pending"))
    throw new Error(
      "Wait for the current chat response to finish before uploading these records.",
    );
  return parsed.data;
}

const metadataSchema = z.object({
  user_id: z.string().uuid(),
  revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  updated_at: z.string(),
});
export type SnapshotMetadata = z.infer<typeof metadataSchema>;
export type SavedSnapshot = SnapshotMetadata & { state: AppState };
export class SnapshotConflict extends Error {
  constructor() {
    super(
      "Your saved records changed on another device. Load the latest saved records before uploading again. Export this device first if you want to keep both copies.",
    );
  }
}
const cloudError = (error: { code?: string } | null): Error => {
  if (error?.code === "40001") return new SnapshotConflict();
  if (["42P01", "42883", "PGRST202", "PGRST205"].includes(error?.code || ""))
    return new Error(
      "Cloud storage is not set up yet. Apply the Rep & Plate database setup, then try again.",
    );
  if (error?.code === "42501")
    return new Error(
      "Cloud access was not allowed. Sign in again and check the database setup.",
    );
  return new Error(
    "The cloud request did not complete. Your device records have not changed. Check your connection and try again.",
  );
};

async function requireUser(
  client: SupabaseClient,
  expectedUserId: string,
): Promise<void> {
  const { data, error } = await client.auth.getUser();
  if (error || data.user?.id !== expectedUserId)
    throw new Error(
      "Your account changed or your session expired. Sign in again before continuing.",
    );
}

export async function readSnapshotMetadata(
  client: SupabaseClient,
  userId: string,
): Promise<SnapshotMetadata | null> {
  await requireUser(client, userId);
  const { data, error } = await client
    .from("fuel_snapshots")
    .select("user_id,revision,updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw cloudError(error);
  if (!data) return null;
  const parsed = metadataSchema.safeParse(data);
  if (!parsed.success || parsed.data.user_id !== userId)
    throw new Error("The saved record details could not be verified.");
  return parsed.data;
}

export async function loadSnapshot(
  client: SupabaseClient,
  userId: string,
): Promise<SavedSnapshot | null> {
  await requireUser(client, userId);
  const { data, error } = await client
    .from("fuel_snapshots")
    .select("user_id,state,revision,updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw cloudError(error);
  if (!data) return null;
  const metadata = metadataSchema.safeParse(data);
  const state = stateSchema.safeParse(data.state);
  if (!metadata.success || metadata.data.user_id !== userId || !state.success)
    throw new Error(
      "Your saved records use an unsupported format. They have not replaced this device.",
    );
  if (snapshotSummary(state.data).bytes > MAX_SNAPSHOT_BYTES)
    throw new Error(
      "The saved copy is too large for this version of Rep & Plate. This device has not changed.",
    );
  return { ...metadata.data, state: state.data };
}

export async function saveSnapshot(
  client: SupabaseClient,
  userId: string,
  state: AppState,
  expectedRevision: number,
): Promise<SnapshotMetadata> {
  const snapshot = prepareSnapshot(state);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
    throw new Error("Check the saved copy before uploading.");
  await requireUser(client, userId);
  const { data, error } = await client.rpc("health_save_snapshot", {
    p_user: userId,
    p_state: snapshot,
    p_expected_revision: expectedRevision,
  });
  if (error) throw cloudError(error);
  const metadata = metadataSchema.safeParse(data);
  if (
    !metadata.success ||
    metadata.data.user_id !== userId ||
    metadata.data.revision <= expectedRevision
  )
    throw new Error(
      "Upload status could not be confirmed. Check the saved copy before retrying.",
    );
  return metadata.data;
}

export async function deleteSnapshot(
  client: SupabaseClient,
  userId: string,
  expectedRevision: number,
): Promise<void> {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1)
    throw new Error("Check the saved copy before deleting.");
  await requireUser(client, userId);
  const { data, error } = await client.rpc("health_delete_snapshot", {
    p_user: userId,
    p_expected_revision: expectedRevision,
  });
  if (error) throw cloudError(error);
  if (!data || data.deleted !== true)
    throw new Error(
      "Deletion could not be confirmed. Check the saved copy before retrying.",
    );
}

export function exportDevice(state: AppState): void {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          format: "fuel-snapshot",
          exportedAt: new Date().toISOString(),
          state,
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `rep-and-plate-records-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
