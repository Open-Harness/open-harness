import type {
  ModelUsage,
  NonNullableUsage,
  Options,
  Query,
  SDKMessage,
  SDKPermissionDenial,
  SDKResultMessage,
  SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { ClaudeAgentInput } from "./claude.agent.js";

type FixtureOutput = {
  text: string;
  structuredOutput?: unknown;
  usage?: NonNullableUsage;
  modelUsage?: Record<string, ModelUsage>;
  totalCostUsd?: number;
  durationMs?: number;
  sessionId?: string;
  numTurns?: number;
  permissionDenials?: unknown[];
};

export type FixtureCall = {
  input: ClaudeAgentInput;
  output: FixtureOutput;
  events: unknown[];
};

export type FixtureFile = {
  calls: FixtureCall[];
};

export type FixtureSet = Record<string, FixtureFile>;

const FixtureInputSchema = z
  .object({
    prompt: z.string().optional(),
    messages: z.array(z.unknown()).optional(),
    options: z.unknown().optional(),
  })
  .refine(
    (value) =>
      (value.prompt && !value.messages) || (!value.prompt && value.messages),
    {
      message: "Provide exactly one of prompt or messages",
    },
  );

const FixtureOutputSchema = z.object({
  text: z.string(),
  structuredOutput: z.unknown().optional(),
  usage: z.unknown().optional(),
  modelUsage: z.unknown().optional(),
  totalCostUsd: z.number().optional(),
  durationMs: z.number().optional(),
  sessionId: z.string().optional(),
  numTurns: z.number().optional(),
  permissionDenials: z.array(z.unknown()).optional(),
});

export const FixtureSchema = z.object({
  calls: z.array(
    z.object({
      input: FixtureInputSchema,
      output: FixtureOutputSchema,
      events: z.array(z.unknown()),
    }),
  ),
});

export function createMockQuery(options: {
  fixtures: FixtureSet;
  selectFixtureKey?: (params: {
    prompt: string | AsyncIterable<SDKUserMessage>;
    options?: Options;
  }) => Promise<string> | string;
}): (params: {
  prompt: string | AsyncIterable<SDKUserMessage>;
  options?: Options;
}) => Query {
  const callCounts = new Map<string, number>();
  const fixtureKeys = Object.keys(options.fixtures);

  return ({ prompt, options: queryOptions }) => {
    const iterator = (async function* () {
      const key = options.selectFixtureKey
        ? await options.selectFixtureKey({ prompt, options: queryOptions })
        : await inferFixtureKey(prompt, options.fixtures, fixtureKeys);

      const fixture = options.fixtures[key];
      if (!fixture) {
        throw new Error(`No fixture found for key: ${key}`);
      }

      const callIndex = callCounts.get(key) ?? 0;
      callCounts.set(key, callIndex + 1);

      const call = fixture.calls[callIndex];
      if (!call) {
        throw new Error(`No fixture call for ${key} at index ${callIndex}`);
      }

      for (const event of call.events) {
        yield event as SDKMessage;
      }

      yield buildResultMessage(call.output);
    })();

    return attachQueryStubs(iterator);
  };
}

async function inferFixtureKey(
  prompt: string | AsyncIterable<SDKUserMessage>,
  fixtures: FixtureSet,
  fixtureKeys: string[],
): Promise<string> {
  if (typeof prompt === "string" && prompt in fixtures) {
    return prompt;
  }

  if (fixtureKeys.length === 1) {
    return fixtureKeys[0] ?? "";
  }

  const firstText = await extractFirstText(prompt);
  if (firstText && firstText in fixtures) {
    return firstText;
  }

  throw new Error(
    "Unable to infer fixture key from prompt; provide selectFixtureKey",
  );
}

async function extractFirstText(
  prompt: string | AsyncIterable<SDKUserMessage>,
): Promise<string | undefined> {
  if (typeof prompt === "string") return prompt;
  for await (const message of prompt) {
    const content = message.message?.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content) && content.length > 0) {
      const first = content[0] as { text?: string } | undefined;
      if (first?.text) return first.text;
    }
  }
  return undefined;
}

function buildResultMessage(output: FixtureOutput): SDKResultMessage {
  const usage: NonNullableUsage = {
    input_tokens: output.usage?.input_tokens ?? 0,
    output_tokens: output.usage?.output_tokens ?? 0,
    cache_creation_input_tokens: output.usage?.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: output.usage?.cache_read_input_tokens ?? 0,
  };

  return {
    type: "result",
    subtype: "success",
    duration_ms: output.durationMs ?? 0,
    duration_api_ms: output.durationMs ?? 0,
    is_error: false,
    num_turns: output.numTurns ?? 1,
    result: output.text,
    total_cost_usd: output.totalCostUsd ?? 0,
    usage,
    modelUsage: output.modelUsage ?? {},
    permission_denials: (output.permissionDenials ??
      []) as SDKPermissionDenial[],
    structured_output: output.structuredOutput,
    uuid: globalThis.crypto.randomUUID(),
    session_id: output.sessionId ?? "fixture-session",
  };
}

function attachQueryStubs(iterator: AsyncGenerator<SDKMessage>): Query {
  const query = iterator as Query;
  query.interrupt = async () => {};
  query.setPermissionMode = async () => {};
  query.setModel = async () => {};
  query.setMaxThinkingTokens = async () => {};
  query.supportedCommands = async () => [];
  query.supportedModels = async () => [];
  query.mcpServerStatus = async () => [];
  query.accountInfo = async () =>
    ({}) as Query["accountInfo"] extends () => Promise<infer T> ? T : never;
  query.rewindFiles = async () => {};
  query.setMcpServers = async () => ({ added: [], removed: [], errors: {} });
  query.streamInput = async () => {};
  return query;
}
