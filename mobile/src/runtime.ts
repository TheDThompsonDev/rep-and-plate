import * as Crypto from "expo-crypto";
// Shared models require standards-based UUIDs; never use Math.random for record identity.
if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: { ...globalThis.crypto, randomUUID: Crypto.randomUUID },
  });
}
if (!globalThis.structuredClone)
  globalThis.structuredClone = (value) => JSON.parse(JSON.stringify(value));
