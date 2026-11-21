export type AiProvider = "claude" | "opencode";

/** Claude CLI is the default; set AI_PROVIDER=opencode in .env.local to use OpenCode. */
export function getAiProvider(): AiProvider {
  return process.env.AI_PROVIDER?.trim().toLowerCase() === "opencode"
    ? "opencode"
    : "claude";
}
