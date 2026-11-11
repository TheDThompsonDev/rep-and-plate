import { describe, expect, it } from "vitest";
import { dataHandling, supportDiagnostics, validSupportUrl } from "./model";
import { agentContextSchema } from "../connections/contracts";

describe("support data minimization", () => {
  it("accepts a single email destination without headers or attachments", () => {
    expect(validSupportUrl("mailto:dthompsondev@gmail.com")).toBe(
      "mailto:dthompsondev@gmail.com",
    );
    for (const value of [
      "mailto:a@example.com?body=private",
      "mailto:a@example.com,b@example.com",
      "mailto:a%0Ab@example.com",
    ])
      expect(validSupportUrl(value)).toBeUndefined();
  });
  it("only allows configured HTTPS contact links without credentials", () => {
    expect(validSupportUrl("https://example.com/support")).toBe(
      "https://example.com/support",
    );
    for (const input of [
      "javascript:alert(1)",
      "http://example.com",
      "https://user:secret@example.com",
      "not a url",
    ])
      expect(validSupportUrl(input)).toBeUndefined();
  });
  it("drops message content disguised as request identifiers", () => {
    const result = JSON.parse(
      supportDiagnostics("web", [
        "my health concern",
        "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      ]),
    );
    expect(result.requestIds).toEqual(["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"]);
    expect(Object.keys(result).sort()).toEqual([
      "app",
      "createdAt",
      "platform",
      "requestIds",
      "version",
    ]);
  });
});

describe("what people are told about connected assistants", () => {
  const entry = dataHandling.find((item) => item.title === "Connected assistants");
  it("explains sharing, imported records, the access key and how access ends", () => {
    expect(entry).toBeDefined();
    for (const statement of [
      "unless you create a connection",
      "only what you allow",
      "processed by that assistant’s provider under its own terms",
      "logged only after you review them",
      "apart from your agreed plan and food diary",
      "does not sign in to those apps itself",
      "remove them in the web app",
      "one-way fingerprint of each access key",
      "as soon as you disconnect it",
      "Account deletion removes your connections, coaching plan and imported records",
    ])
      expect(entry!.text).toContain(statement);
  });
  it("matches what a connection can actually read: no photos, conversations or profile", () => {
    expect(entry!.text).toContain("Photos, your conversations with Spot and your password are never available");
    const shared = Object.keys(agentContextSchema.shape);
    expect(shared.sort()).toEqual(["activities", "day", "nutrition", "pantry", "preferences", "timezone", "truncated", "workouts"]);
  });
});
