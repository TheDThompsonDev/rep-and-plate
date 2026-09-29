import { describe, it, expect } from "vitest";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { betaHandler, type BetaServices } from "./beta";

async function serve(
  services: BetaServices,
  run: (url: string) => Promise<void>,
) {
  const server = createServer(betaHandler(services));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
const services = (): BetaServices => ({
  config: { model: "test", jevModel: "test" },
  origin: "https://health.example",
  publicConfig: {
    url: "https://test.supabase.co",
    publishableKey: "sb_publishable_testtesttesttest",
  },
  authenticate: async (token) => (token === "valid" ? "user-a" : null),
  admit: async () => ({ allowed: true, lease: "lease" }),
  release: async () => {},
  chatCache: {
    claim: async () => ({ status: "new", lease: "chat" }),
    finish: async () => {},
    fail: async () => {},
  },
});
describe("hosted beta boundary", () => {
  it("allows auth bootstrap but never trusts spoofed hosts or user headers", async () => {
    let admissions = 0;
    const s = services();
    s.admit = async () => {
      admissions++;
      return { allowed: true, lease: "lease" };
    };
    await serve(s, async (url) => {
      expect((await fetch(url + "/api/cloud/config")).status).toBe(200);
      expect(
        (
          await fetch(url + "/api/status", {
            headers: { Host: "localhost", "x-user-id": "user-a" },
          })
        ).status,
      ).toBe(401);
      expect(
        (
          await fetch(url + "/api/status", {
            headers: { Authorization: "Bearer forged" },
          })
        ).status,
      ).toBe(401);
      expect(
        (
          await fetch(url + "/api/status", {
            headers: { Authorization: "Bearer valid" },
          })
        ).status,
      ).toBe(200);
      expect(admissions).toBe(1);
    });
  });
  it("fails closed on quota service outages and disallowed origins", async () => {
    const s = services();
    s.admit = async () => {
      throw Error("private database details");
    };
    await serve(s, async (url) => {
      const blocked = await fetch(url + "/api/status", {
        headers: {
          Authorization: "Bearer valid",
          Origin: "https://evil.example",
        },
      });
      expect(blocked.status).toBe(403);
      const response = await fetch(url + "/api/status", {
        headers: { Authorization: "Bearer valid" },
      });
      expect(response.status).toBe(503);
      expect(await response.text()).not.toContain("private");
    });
  });
  it("enforces shared admission and releases the exact lease", async () => {
    const s = services();
    const released: string[] = [];
    s.admit = async (user) => {
      expect(user).toBe("user-a");
      return { allowed: false, lease: "" };
    };
    s.release = async (lease) => {
      released.push(lease);
    };
    await serve(s, async (url) => {
      const response = await fetch(url + "/api/status", {
        headers: { Authorization: "Bearer valid" },
      });
      expect(response.status).toBe(429);
      expect(released).toEqual([]);
      s.admit = async () => ({ allowed: true, lease: "exact-lease" });
      await fetch(url + "/api/status", {
        headers: { Authorization: "Bearer valid" },
      });
      expect(released).toEqual(["exact-lease"]);
    });
  });
  it("rejects another account’s capture path before touching storage", async () => {
    const s = services();
    let reads = 0;
    s.readCapture = async () => {
      reads++;
      throw Error("must not read");
    };
    await serve(s, async (url) => {
      const response = await fetch(url + "/api/chat", {
        method: "POST",
        headers: {
          Authorization: "Bearer valid",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          capture: { path: "other-user/file.jpg", kind: "image" },
        }),
      });
      expect(response.status).toBe(400);
      expect(reads).toBe(0);
    });
  });
});
