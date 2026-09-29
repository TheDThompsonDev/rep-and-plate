import { describe, expect, it, vi } from "vitest";
import { accountDeletion, type AccountDependencies } from "./account";

function fixture() {
  const deps: AccountDependencies = {
    identify: vi.fn(async () => ({ id: "owner-a", email: "a@example.test" })),
    reauthenticate: vi.fn(async () => "owner-a"),
    beginDeletion: vi.fn(async () => {}),
    listCaptures: vi.fn(async () => []),
    removeCaptures: vi.fn(async () => {}),
    deleteUser: vi.fn(async () => {}),
  };
  return { deps, remove: accountDeletion(deps) };
}
const input = { confirmation: "DELETE", password: "secret" };
describe("account deletion boundary", () => {
  it("rejects missing confirmation and supplied account IDs before any mutation", async () => {
    for (const body of [
      { password: "secret" },
      { ...input, userId: "victim" },
    ]) {
      const { deps, remove } = fixture();
      await expect(remove("token", body)).rejects.toMatchObject({
        status: 400,
      });
      expect(deps.beginDeletion).not.toHaveBeenCalled();
    }
  });
  it("denies invalid bearer identity, wrong passwords and mismatched reauth users", async () => {
    const first = fixture();
    vi.mocked(first.deps.identify).mockResolvedValue(null);
    await expect(first.remove("expired", input)).rejects.toMatchObject({
      status: 401,
    });
    expect(first.deps.reauthenticate).not.toHaveBeenCalled();
    for (const id of [null, "other-user"]) {
      const { deps, remove } = fixture();
      vi.mocked(deps.reauthenticate).mockResolvedValue(id);
      await expect(remove("token", input)).rejects.toMatchObject({
        status: 401,
      });
      expect(deps.beginDeletion).not.toHaveBeenCalled();
      expect(deps.deleteUser).not.toHaveBeenCalled();
    }
  });
  it("locks writes before draining both buckets then deletes only verified owner", async () => {
    const { deps, remove } = fixture();
    const order: string[] = [];
    vi.mocked(deps.beginDeletion).mockImplementation(async (id) => {
      order.push(`lock:${id}`);
    });
    vi.mocked(deps.listCaptures)
      .mockResolvedValueOnce(["owner-a/receipt.jpg"])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(["owner-a/meal.jpg"])
      .mockResolvedValueOnce([]);
    vi.mocked(deps.removeCaptures).mockImplementation(async (paths, bucket) => {
      order.push(`remove:${bucket}:${paths[0]}`);
    });
    vi.mocked(deps.deleteUser).mockImplementation(async (id) => {
      order.push(`delete:${id}`);
    });
    await expect(remove("token", input)).resolves.toEqual({ deleted: true });
    expect(deps.reauthenticate).toHaveBeenCalledWith(
      "a@example.test",
      "secret",
    );
    expect(order).toEqual([
      "lock:owner-a",
      "remove:health-captures:owner-a/receipt.jpg",
      "remove:health-record-media:owner-a/meal.jpg",
      "delete:owner-a",
    ]);
  });
  it("never deletes a user when storage cleanup fails or contains another owner", async () => {
    const { deps, remove } = fixture();
    vi.mocked(deps.listCaptures).mockResolvedValue(["victim/receipt.jpg"]);
    await expect(remove("token", input)).rejects.toMatchObject({ status: 503 });
    expect(deps.removeCaptures).not.toHaveBeenCalled();
    expect(deps.deleteUser).not.toHaveBeenCalled();
    vi.mocked(deps.listCaptures).mockRejectedValue(new Error("storage down"));
    await expect(remove("token", input)).rejects.toThrow("storage down");
    expect(deps.deleteUser).not.toHaveBeenCalled();
  });
  it("a cleanup retry drains remaining files without skipping them", async () => {
    const { deps, remove } = fixture();
    vi.mocked(deps.listCaptures)
      .mockResolvedValueOnce(["owner-a/file.jpg"])
      .mockRejectedValueOnce(new Error("interrupted"));
    await expect(remove("token", input)).rejects.toThrow("interrupted");
    vi.mocked(deps.listCaptures).mockResolvedValue([]);
    await expect(remove("token", input)).resolves.toEqual({ deleted: true });
    expect(deps.deleteUser).toHaveBeenCalledTimes(1);
  });
});
