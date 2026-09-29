import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.create }));
import {
  changeAccountPassword,
  recoverPassword,
  registerAccountConfig,
  requestPasswordCode,
} from "./account-client";
const config = {
  url: "https://example.supabase.co",
  publishableKey: "sb_publishable_012345678901234567890",
};
let shared: SupabaseClient;
let isolated: {
  auth: {
    signInWithOtp: ReturnType<typeof vi.fn>;
    verifyOtp: ReturnType<typeof vi.fn>;
    updateUser: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
    signInWithPassword: ReturnType<typeof vi.fn>;
  };
};
beforeEach(() => {
  vi.clearAllMocks();
  shared = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "owner", email: "person@example.test" } },
        error: null,
      })),
    },
  } as unknown as SupabaseClient;
  registerAccountConfig(shared, config);
  isolated = {
    auth: {
      signInWithOtp: vi.fn(async () => ({ error: null })),
      verifyOtp: vi.fn(async () => ({
        data: {
          session: { access_token: "test" },
          user: { id: "owner", email: "person@example.test" },
        },
        error: null,
      })),
      updateUser: vi.fn(async () => ({ error: null })),
      signOut: vi.fn(async () => ({ error: null })),
      signInWithPassword: vi.fn(async () => ({
        data: { user: { id: "owner" } },
        error: null,
      })),
    },
  };
  mocks.create.mockReturnValue(isolated);
});
describe("password recovery and update", () => {
  it("requests a code without creating an account or persisting recovery sessions", async () => {
    await requestPasswordCode(shared, "person@example.test");
    expect(isolated.auth.signInWithOtp).toHaveBeenCalledWith({
      email: "person@example.test",
      options: { shouldCreateUser: false },
    });
    expect(mocks.create).toHaveBeenCalledWith(
      config.url,
      config.publishableKey,
      expect.objectContaining({
        auth: expect.objectContaining({
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        }),
      }),
    );
  });
  it("verifies email proof before updating password and signs out isolated client", async () => {
    await recoverPassword(
      shared,
      "person@example.test",
      "123456",
      "new-password",
    );
    expect(isolated.auth.verifyOtp).toHaveBeenCalledWith({
      email: "person@example.test",
      token: "123456",
      type: "email",
    });
    expect(isolated.auth.updateUser).toHaveBeenCalledWith({
      password: "new-password",
    });
    expect(isolated.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("rejects expired code without changing a password", async () => {
    isolated.auth.verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: "otp_expired" },
    });
    await expect(
      recoverPassword(shared, "person@example.test", "123456", "new-password"),
    ).rejects.toThrow("invalid or has expired");
    expect(isolated.auth.updateUser).not.toHaveBeenCalled();
    expect(isolated.auth.signOut).toHaveBeenCalled();
  });
  it("does not change a mismatched recovered email or reauthenticated account", async () => {
    await expect(
      recoverPassword(shared, "other@example.test", "123456", "new-password"),
    ).rejects.toThrow("invalid or has expired");
    isolated.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: "other" } },
      error: null,
    });
    await expect(
      changeAccountPassword(shared, "old-password", "new-password"),
    ).rejects.toThrow("could not be confirmed");
    expect(isolated.auth.updateUser).not.toHaveBeenCalled();
  });
  it("requires password strength locally and reports provider rejection", async () => {
    await expect(
      recoverPassword(shared, "person@example.test", "123456", "short"),
    ).rejects.toThrow("between 8 and 128");
    isolated.auth.updateUser.mockResolvedValue({
      error: { code: "weak_password" },
    });
    await expect(
      recoverPassword(shared, "person@example.test", "123456", "new-password"),
    ).rejects.toThrow("was not accepted");
    expect(isolated.auth.signOut).toHaveBeenCalled();
  });
  it("changes password only after matching current account credentials", async () => {
    await changeAccountPassword(shared, "old-password", "new-password");
    expect(isolated.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "person@example.test",
      password: "old-password",
    });
    expect(isolated.auth.updateUser).toHaveBeenCalledWith({
      password: "new-password",
    });
  });
});
