import type { AIResult } from "../src/ai-contract.ts";
export type ChatClaim =
  | { status: "new"; lease: string }
  | { status: "cached"; result: AIResult }
  | { status: "busy" | "mismatch" };
export interface ChatCache {
  claim(user: string, request: string, hash: string): Promise<ChatClaim>;
  finish(
    user: string,
    request: string,
    lease: string,
    result: AIResult,
  ): Promise<void>;
  fail(user: string, request: string, lease: string): Promise<void>;
}
