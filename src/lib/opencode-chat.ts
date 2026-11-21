import crossSpawn from "cross-spawn";
import { getOpenCodeModel } from "@/lib/opencode-path";

const SESSION_ID_PATTERN = /^ses_[A-Za-z0-9_-]+$/;

type SsePayload =
  | { type: "token"; text: string }
  | { type: "result"; text: string }
  | { type: "error"; message: string };

interface OpenCodeChatOptions {
  openCodePath: string;
  message: string;
  systemPrompt: string;
  sessionId?: string;
  carouselName?: string;
  baseUrl: string;
}

/**
 * Runs `opencode run` with the project's `carrusel` agent and streams the
 * answer in the same SSE format the Claude provider uses.
 */
export function streamOpenCode({
  openCodePath,
  message,
  systemPrompt,
  sessionId,
  carouselName,
  baseUrl,
}: OpenCodeChatOptions): Response {
  const prompt = `# Open Carrusel context

${systemPrompt.replaceAll("http://localhost:3000", baseUrl)}

---

# User request

${message}`;

  const args = [
    "run",
    "--format",
    "json",
    "--agent",
    "carrusel",
    "--auto",
    "--title",
    `Open Carrusel — ${carouselName || "Chat"}`.slice(0, 80),
  ];
  const model = getOpenCodeModel();
  if (model) args.push("--model", model);
  if (sessionId && SESSION_ID_PATTERN.test(sessionId)) {
    args.push("--session", sessionId);
  }
  args.push(prompt);

  const abortController = new AbortController();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const emit = (payload: SsePayload) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
          );
        } catch {
          // stream already closed
        }
      };

      let child: ReturnType<typeof crossSpawn>;
      try {
        child = crossSpawn(openCodePath, args, {
          cwd: process.cwd(),
          signal: abortController.signal,
          stdio: ["ignore", "pipe", "pipe"],
        });
      } catch (err) {
        emit({
          type: "error",
          message: `Failed to start OpenCode CLI: ${(err as Error)?.message ?? ""}`,
        });
        controller.close();
        return;
      }

      let buffer = "";
      let resolvedSessionId = "";
      let accumulated = "";
      let hadError = false;
      const textByPart = new Map<string, string>();

      const handleEvent = (event: Record<string, unknown>) => {
        if (typeof event.sessionID === "string") {
          resolvedSessionId = event.sessionID;
        }

        if (event.type === "text") {
          const part = event.part as
            | { id?: unknown; type?: unknown; text?: unknown }
            | undefined;
          if (part && part.type === "text" && typeof part.text === "string") {
            const partId = typeof part.id === "string" ? part.id : "text";
            const previous = textByPart.get(partId) ?? "";
            const delta =
              previous && part.text.startsWith(previous)
                ? part.text.slice(previous.length)
                : part.text;
            textByPart.set(partId, part.text);
            if (delta) {
              accumulated += delta;
              emit({ type: "token", text: delta });
            }
          }
          return;
        }

        if (event.type === "error") {
          hadError = true;
          const error = event.error as { message?: unknown } | undefined;
          emit({
            type: "error",
            message:
              (typeof error?.message === "string" && error.message) ||
              (typeof event.message === "string" && event.message) ||
              "OpenCode reported an error",
          });
        }
      };

      const handleLine = (line: string) => {
        if (!line.trim()) return;
        try {
          const event = JSON.parse(line);
          if (event && typeof event === "object") handleEvent(event);
        } catch {
          // non-JSON diagnostics
        }
      };

      child.stdout?.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) handleLine(line);
      });

      let stderrBuf = "";
      child.stderr?.on("data", (chunk: Buffer) => {
        stderrBuf = (stderrBuf + chunk.toString()).slice(-8192);
      });

      const timeout = setTimeout(() => child.kill(), 480_000);

      child.on("error", (err) => {
        clearTimeout(timeout);
        emit({
          type: "error",
          message: err.message || "OpenCode subprocess failed",
        });
        try {
          controller.close();
        } catch {
          // already closed
        }
      });

      child.on("exit", (code) => {
        clearTimeout(timeout);
        if (buffer.trim()) handleLine(buffer);

        if (!hadError && accumulated) {
          emit({ type: "result", text: accumulated });
        } else if (!hadError && !accumulated && code === 0) {
          emit({ type: "result", text: "Done." });
        }
        if (code && code !== 0 && !hadError) {
          console.error("[chat] OpenCode exited non-zero", {
            exitCode: code,
            stderr: stderrBuf,
          });
          emit({ type: "error", message: `OpenCode exited with code ${code}` });
        }

        try {
          controller.enqueue(
            encoder.encode(
              `event: done\ndata: ${JSON.stringify({
                sessionId: resolvedSessionId,
                exitCode: code,
              })}\n\n`
            )
          );
          controller.close();
        } catch {
          // stream already closed
        }
      });
    },

    cancel() {
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
