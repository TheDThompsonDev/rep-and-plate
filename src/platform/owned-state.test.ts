import { describe, expect, it } from "vitest";
import { OwnedStateGate } from "./owned-state";
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}
describe("account state readiness", () => {
  it("never exposes old records to sync or profile edits during a delayed owner load", async () => {
    let owner = "A",
      epoch = 0;
    const second = deferred<string>();
    const gate = new OwnedStateGate({
      epoch: () => epoch,
      owner: async () => owner,
      load: () =>
        owner === "A" ? Promise.resolve("private A") : second.promise,
    });
    await gate.refresh(
      () => {},
      (error) => {
        throw error;
      },
    );
    expect(gate.current).toBe("private A");
    owner = "B";
    epoch++;
    const refresh = gate.refresh(
      () => {},
      (error) => {
        throw error;
      },
    );
    expect(gate.current).toBeNull();
    expect(() => gate.set("A with new profile")).toThrow("account changed");
    let ready = false;
    const waiting = gate.wait().then((value) => {
      ready = true;
      return value;
    });
    await Promise.resolve();
    expect(ready).toBe(false);
    second.resolve("private B");
    await refresh;
    expect(await waiting).toBe("private B");
    expect(gate.current).toBe("private B");
  });
  it("late prior-owner reads and closed subscriptions cannot overwrite the current owner", async () => {
    let owner = "A",
      epoch = 0;
    const first = deferred<string>();
    const published: string[] = [];
    const gate = new OwnedStateGate({
      epoch: () => epoch,
      owner: async () => owner,
      load: () =>
        owner === "A" ? first.promise : Promise.resolve("private B"),
    });
    const old = gate.refresh(
      (value) => {
        if (value) published.push(value);
      },
      () => {},
    );
    await Promise.resolve();
    owner = "B";
    epoch++;
    await gate.refresh(
      (value) => {
        if (value) published.push(value);
      },
      () => {},
    );
    first.resolve("private A");
    await old;
    expect(gate.current).toBe("private B");
    expect(published).toEqual(["private B"]);
    const late = gate.refresh(
      (value) => {
        if (value) published.push(value);
      },
      () => {},
    );
    gate.close();
    await late;
    expect(gate.current).toBeNull();
    expect(published).toEqual(["private B"]);
  });
});
