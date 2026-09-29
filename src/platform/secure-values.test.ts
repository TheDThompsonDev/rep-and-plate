import { it, expect } from "vitest";
import { chunkedStorage } from "./secure-values";
it("preserves long unicode sessions and the last committed generation on failure", async () => {
  const values = new Map<string, string>();
  let fail = false;
  let n = 0;
  const storage = chunkedStorage(
    {
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => {
        if (fail && key.endsWith(".1")) throw Error("full");
        values.set(key, value);
      },
      removeItem: async (key) => {
        values.delete(key);
      },
    },
    () => `g${++n}`,
  );
  const token = "🔒abc".repeat(1000);
  await storage.setItem("auth", token);
  expect(await storage.getItem("auth")).toBe(token);
  expect(
    [...values.values()].every(
      (v) => new TextEncoder().encode(v).length < 2000,
    ),
  ).toBe(true);
  fail = true;
  await expect(storage.setItem("auth", "x".repeat(1000))).rejects.toThrow(
    "full",
  );
  expect(await storage.getItem("auth")).toBe(token);
  await storage.removeItem("auth");
  expect(await storage.getItem("auth")).toBeNull();
});
