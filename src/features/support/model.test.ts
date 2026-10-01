import { describe, expect, it } from "vitest";
import { supportDiagnostics, validSupportUrl } from "./model";

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
