import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const deletionSchema = z
  .object({
    confirmation: z.literal("DELETE"),
    password: z.string().min(1).max(1024),
  })
  .strict();
export class AccountError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export type AccountDependencies = {
  identify: (token: string) => Promise<{ id: string; email?: string } | null>;
  reauthenticate: (email: string, password: string) => Promise<string | null>;
  beginDeletion: (id: string) => Promise<void>;
  listCaptures: (id: string, bucket: string) => Promise<string[]>;
  removeCaptures: (paths: string[], bucket: string) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
};

/** Deliberately independent of beta membership: every account can delete itself.
 * The subject and email are obtained from verified authentication, never input.
 * A deletion marker blocks uploads/sync while storage and Auth are cleaned up.
 */
export function accountDeletion(deps: AccountDependencies) {
  return async (token: string, input: unknown) => {
    const parsed = deletionSchema.safeParse(input);
    if (!parsed.success)
      throw new AccountError(
        400,
        "Type DELETE and enter your current password to delete your account.",
      );
    const user = await deps.identify(token);
    if (!user?.email)
      throw new AccountError(
        401,
        "Sign in again before deleting your account.",
      );
    const confirmed = await deps.reauthenticate(
      user.email,
      parsed.data.password,
    );
    if (confirmed !== user.id)
      throw new AccountError(
        401,
        "Your password could not be confirmed. Your account has not been deleted.",
      );
    await deps.beginDeletion(user.id);
    // list/delete from offset zero so batches cannot skip rows as they disappear.
    // The marker prevents new inserts, bounding the drain even across retries.
    for (const bucket of ["health-captures", "health-record-media"]) {
      let drained = false;
      for (let batch = 0; batch < 100; batch++) {
        const paths = await deps.listCaptures(user.id, bucket);
        if (!paths.length) {
          drained = true;
          break;
        }
        if (
          paths.some(
            (path) =>
              !path.startsWith(`${user.id}/`) ||
              path
                .split("/")
                .some((part) => !part || part === "." || part === ".."),
          )
        )
          throw new AccountError(
            503,
            "Account cleanup could not be verified. Please retry.",
          );
        await deps.removeCaptures(paths, bucket);
      }
      if (!drained)
        throw new AccountError(
          503,
          "Account cleanup is still in progress. Please retry to finish.",
        );
    }
    await deps.deleteUser(user.id);
    return { deleted: true as const };
  };
}

export function createAccountDeletion(
  publicConfig: { url: string; publishableKey: string },
  admin: SupabaseClient,
) {
  const authClient = () =>
    createClient(publicConfig.url, publicConfig.publishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: (input, init) =>
          fetch(input, { ...init, signal: AbortSignal.timeout(10000) }),
      },
    });
  const fail = () =>
    new AccountError(
      503,
      "Account deletion could not finish. Your account is locked for cleanup; retry deletion to finish.",
    );
  return accountDeletion({
    identify: async (token) => {
      const { data, error } = await authClient().auth.getUser(token);
      return error ? null : data.user;
    },
    reauthenticate: async (email, password) => {
      // Never reuse a mutable auth client between users or requests.
      const client = authClient();
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (error) return null;
      const id = data.user?.id ?? null;
      await client.auth.signOut({ scope: "local" }).catch(() => {});
      return id;
    },
    beginDeletion: async (id) => {
      const { error } = await admin.rpc("health_begin_account_deletion", {
        p_user: id,
      });
      if (error)
        throw new AccountError(
          503,
          "Account deletion is temporarily unavailable. Your records have not been deleted.",
        );
    },
    listCaptures: async (id, bucket) => {
      const paths: string[] = [];
      let visited = 0;
      const visit = async (prefix: string, depth: number) => {
        if (depth > 16) throw fail();
        for (let offset = 0; paths.length < 100; offset += 100) {
          const { data, error } = await admin.storage
            .from(bucket)
            .list(prefix, { limit: 100, offset });
          if (error || !data || (visited += data.length) > 10000) throw fail();
          for (const file of data) {
            if (
              !file.name ||
              file.name.includes("/") ||
              file.name === "." ||
              file.name === ".."
            )
              throw fail();
            const path = `${prefix}/${file.name}`;
            if (file.id) paths.push(path);
            else await visit(path, depth + 1);
            if (paths.length >= 100) return;
          }
          if (data.length < 100) return;
        }
      };
      await visit(id, 0);
      return paths;
    },
    removeCaptures: async (paths, bucket) => {
      const { error } = await admin.storage.from(bucket).remove(paths);
      if (error) throw fail();
    },
    deleteUser: async (id) => {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw fail();
    },
  });
}
