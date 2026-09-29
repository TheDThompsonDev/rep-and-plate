import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { initialState } from "../../domain";
import { resultFixture } from "../../../tests/ai-fixtures";
import { prepareRecipeBatch,logRecipePortion } from "../recipes/batches";
import { deleteMealWithPantry,getPantryLots } from "../pantry/ledger";
import {
  deleteSnapshot,
  loadSnapshot,
  prepareSnapshot,
  readSnapshotMetadata,
  saveSnapshot,
  snapshotSummary,
  SnapshotConflict,
  validateCloudConfig,
} from "./client";

const userId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const metadata = {
  user_id: userId,
  revision: 7,
  updated_at: "2026-09-25T18:00:00Z",
};
function fakeClient({
  user = userId,
  data = null as unknown,
  error = null as { code: string; message?: string } | null,
} = {}) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  const from = vi.fn().mockReturnValue(query);
  return {
    client: {
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: user } }, error: null }),
      },
      rpc,
      from,
    } as unknown as SupabaseClient,
    rpc,
    from,
    query,
  };
}

describe("cloud configuration and snapshots", () => {
  it("preserves batch portions, date reminders and inventory history in a reviewed backup",()=>{
    const state=initialState();
    const receipt=resultFixture('backup-fixture').receipt!;
    receipt.items[0].pantryDates={labelKind:'best-before',labelDate:'2026-10-01',openedDate:'2026-09-25'};
    state.groceries=[receipt];
    const prepared=prepareRecipeBatch(state,{id:'backup-batch',name:'Milk portions',totalPortions:4,ingredients:[{lotId:`${receipt.id}::${receipt.items[0].id}`,servings:2}]});
    const eaten=logRecipePortion(prepared,'backup-batch',1,'Snack','backup-portion');
    const restored=prepareSnapshot(JSON.parse(JSON.stringify(eaten)));
    expect(restored).toEqual(eaten);expect(snapshotSummary(restored).recipeBatches).toBe(1);
    const removed=deleteMealWithPantry(restored,'recipe-meal:backup-portion');
    expect(getPantryLots(removed)[0].remaining).toBe(14);
    expect(removed.recipeBatches![0].consumptions[0].reversedAt).toBeDefined();
    expect(removed.groceries![0].items[0].pantryDates).toEqual(receipt.items[0].pantryDates);
  });
  it("accepts only project HTTPS URLs and modern publishable browser keys", () => {
    const config = {
      url: "https://testproject.supabase.co",
      publishableKey: "sb_publishable_fixture_key_long_enough",
    };
    expect(validateCloudConfig(config)).toEqual(config);
    for (const key of [
      "sb_secret_fixture_key_long_enough",
      "service_role",
      "eyJlegacyServiceRoleJWT",
    ])
      expect(
        validateCloudConfig({ ...config, publishableKey: key }),
      ).toBeNull();
    for (const url of [
      "http://testproject.supabase.co",
      "https://user:password@testproject.supabase.co",
      "https://testproject.supabase.co/path",
      "https://example.com",
    ])
      expect(validateCloudConfig({ ...config, url })).toBeNull();
    expect(validateCloudConfig({ available: false })).toBeNull();
  });
  it("validates snapshot versions and rejects oversized uploads or in-flight chat", () => {
    const state = initialState();
    expect(prepareSnapshot(state)).toEqual(state);
    expect(() => prepareSnapshot({ ...state, version: 2 })).toThrow(
      "unsupported format",
    );
    const pending = {
      ...state,
      messages: [
        {
          id: "pending",
          role: "user" as const,
          time: "now",
          text: "Meal",
          aiStatus: "pending" as const,
        },
      ],
    };
    expect(() => prepareSnapshot(pending)).toThrow("finish");
    const large = {
      ...state,
      messages: [
        {
          id: "large",
          role: "user" as const,
          time: "now",
          text: "Meal",
          image: `data:image/png;base64,${"A".repeat(4_800_000)}`,
        },
      ],
    };
    expect(() => prepareSnapshot(large)).toThrow("4.8 MB");
    expect(snapshotSummary(large).embeddedPhotos).toBe(1);
  });
  it("saves through the compare-and-swap RPC bound to the reviewed account", async () => {
    const { client, rpc } = fakeClient({ data: metadata });
    const state = initialState();
    expect(await saveSnapshot(client, userId, state, 3)).toEqual(metadata);
    expect(rpc).toHaveBeenCalledWith("health_save_snapshot", {
      p_user: userId,
      p_state: state,
      p_expected_revision: 3,
    });
  });
  it("exposes revision conflicts instead of retrying an overwrite", async () => {
    const { client, rpc } = fakeClient({
      error: { code: "40001", message: "private SQL details" },
    });
    await expect(
      saveSnapshot(client, userId, initialState(), 7),
    ).rejects.toBeInstanceOf(SnapshotConflict);
    expect(rpc).toHaveBeenCalledOnce();
  });
  it("blocks a switched account before reads or writes", async () => {
    const { client, rpc, from } = fakeClient({ user: otherId });
    await expect(
      saveSnapshot(client, userId, initialState(), 0),
    ).rejects.toThrow("account changed");
    await expect(loadSnapshot(client, userId)).rejects.toThrow(
      "account changed",
    );
    expect(rpc).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });
  it('binds mutations even when auth changes after the getUser preflight', async () => {
    let current = userId, writes = 0;
    const { client, rpc } = fakeClient();
    vi.mocked(client.auth.getUser).mockImplementation(async () => {
      current = otherId;
      return { data: { user: { id: userId } }, error: null } as never;
    });
    rpc.mockImplementation(async (_name, args) => {
      if (args.p_user !== current) return { data: null, error: { code: '42501' } };
      writes++; return { data: metadata, error: null };
    });
    await expect(saveSnapshot(client,userId,initialState(),0)).rejects.toThrow('not allowed');
    await expect(deleteSnapshot(client,userId,7)).rejects.toThrow('not allowed');
    expect(writes).toBe(0);
  });
  it("loads only the signed-in user's valid snapshot and rejects foreign or incompatible payloads", async () => {
    const good = fakeClient({ data: { ...metadata, state: initialState() } });
    expect((await loadSnapshot(good.client, userId))?.state).toEqual(
      initialState(),
    );
    expect(good.query.eq).toHaveBeenCalledWith("user_id", userId);
    const foreign = fakeClient({
      data: { ...metadata, user_id: otherId, state: initialState() },
    });
    await expect(loadSnapshot(foreign.client, userId)).rejects.toThrow(
      "unsupported format",
    );
    const unsupported = fakeClient({
      data: { ...metadata, state: { version: 9 } },
    });
    await expect(loadSnapshot(unsupported.client, userId)).rejects.toThrow(
      "unsupported format",
    );
    expect(await readSnapshotMetadata(fakeClient().client, userId)).toBeNull();
  });
  it("deletes only with the reviewed revision and translates missing setup without exposing SQL errors", async () => {
    const { client, rpc } = fakeClient({ data: { deleted: true } });
    await deleteSnapshot(client, userId, 7);
    expect(rpc).toHaveBeenCalledWith("health_delete_snapshot", {
      p_user: userId,
      p_expected_revision: 7,
    });
    const missing = fakeClient({
      error: { code: "42P01", message: "private SQL details" },
    });
    await expect(readSnapshotMetadata(missing.client, userId)).rejects.toThrow(
      "not set up",
    );
    const failure = fakeClient({
      error: { code: "other", message: "private SQL details" },
    });
    await expect(
      saveSnapshot(failure.client, userId, initialState(), 0),
    ).rejects.not.toThrow("private SQL details");
  });
});
