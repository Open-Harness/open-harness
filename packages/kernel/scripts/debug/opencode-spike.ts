/**
 * OpenCode SDK spike: validate prompt injection, mailbox behavior, and streaming.
 *
 * Usage:
 *   OPENCODE_BASE_URL=http://127.0.0.1:4096 bun scripts/debug/opencode-spike.ts
 *   OPENCODE_START_SERVER=1 bun scripts/debug/opencode-spike.ts
 */

import {
  createOpencode,
  createOpencodeClient,
  type Event,
  type Message,
  type Part,
} from "@opencode-ai/sdk";

const startedAt = Date.now();
const iso = (): string => new Date().toISOString();
const elapsed = (): string => `${Date.now() - startedAt}ms`;
const log = (message: string, details?: string): void => {
  const suffix = details ? ` ${details}` : "";
  console.log(`[${iso()} +${elapsed()}] ${message}${suffix}`);
};

process.on("beforeExit", (code) => {
  log("process:beforeExit", `code=${code}`);
});
process.on("exit", (code) => {
  log("process:exit", `code=${code}`);
});
process.on("unhandledRejection", (reason) => {
  log("process:unhandledRejection", String(reason));
});
process.on("uncaughtException", (error) => {
  log("process:uncaughtException", error instanceof Error ? error.stack ?? error.message : String(error));
});

const keepAlive = setInterval(() => {}, 1000);
const watchdogMs = 90_000;
let watchdog: ReturnType<typeof setTimeout> | null = null;
let done = false;

const finish = (reason: string, exitCode?: number): void => {
  if (done) return;
  done = true;
  if (watchdog) clearTimeout(watchdog);
  clearInterval(keepAlive);
  log("finish", reason);
  if (exitCode !== undefined) {
    process.exitCode = exitCode;
  }
};

type OpenCodeClient = ReturnType<typeof createOpencodeClient>;

function isTextPart(part: Part): part is Part & { type: "text"; text?: string } {
  return (part as { type?: string }).type === "text";
}

async function run(): Promise<void> {
  log("spike:start");

  watchdog = setTimeout(() => {
    log("watchdog:timeout", `ms=${watchdogMs}`);
    finish("timeout", 1);
    process.exit(1);
  }, watchdogMs);

  const baseUrl = process.env.OPENCODE_BASE_URL ?? "http://127.0.0.1:4096";
  const startServer = process.env.OPENCODE_START_SERVER === "1";
  const providerID = process.env.OPENCODE_PROVIDER_ID;
  const modelID = process.env.OPENCODE_MODEL_ID;

  let client: OpenCodeClient;
  let closeServer: (() => void) | null = null;

  if (startServer) {
    const opencode = await createOpencode({
      hostname: "127.0.0.1",
      port: 4096,
    });
    client = opencode.client;
    closeServer = () => opencode.server.close();
    log("server:start", opencode.server.url);
  } else {
    client = createOpencodeClient({
      baseUrl,
      responseStyle: "data",
    });
    log("server:connect", baseUrl);
  }

  const health = await client.global.health();
  log("health", `version=${health.version}`);

  const session = await client.session.create({
    body: { title: "opencode-spike" },
  });
  log("session:create", session.id);

  const events = await client.event.subscribe();
  const eventTask = (async () => {
    for await (const event of events.stream) {
      const payload = (event as Event).properties as { sessionID?: string } | undefined;
      if (payload?.sessionID && payload.sessionID !== session.id) continue;

      if (event.type === "message.part.updated") {
        const part = (event.properties as { part: Part; delta?: string }).part;
        if (isTextPart(part)) {
          const delta = (event.properties as { delta?: string }).delta;
          log("event:text", delta ? JSON.stringify(delta) : JSON.stringify(part.text ?? ""));
        } else {
          log("event:part", part.type ?? "unknown");
        }
      } else if (event.type === "message.updated") {
        const info = (event.properties as { info: Message }).info;
        log("event:message.updated", `${info.id} role=${info.role}`);
      } else if (event.type === "session.status") {
        log("event:session.status", JSON.stringify(event.properties));
      } else if (event.type === "session.idle") {
        log("event:session.idle", session.id);
      }
    }
  })();

  const model = providerID && modelID ? { providerID, modelID } : undefined;

  await client.session.prompt({
    path: { id: session.id },
    body: {
      noReply: true,
      system: "You are a helpful assistant.",
      model,
      parts: [{ type: "text", text: "Context injection: Use concise answers." }],
    },
  });
  log("context:sent");

  const response = await client.session.prompt({
    path: { id: session.id },
    body: {
      system: "Reply with a single word.",
      model,
      parts: [{ type: "text", text: "Hello" }],
    },
  });

  const assistantText = response.parts
    .filter(isTextPart)
    .map((part) => part.text ?? "")
    .join("");

  log("response:assistant", assistantText.trim());

  await Promise.race([
    eventTask,
    new Promise((resolve) => setTimeout(resolve, 2000)),
  ]);

  closeServer?.();
  finish("done", 0);
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  log("run:error", message);
  finish("exception", 1);
});
